// // ©2015 - 2024 Candy Smith
// // All rights reserved
// // Redistribution of this software is strictly not allowed.
// // Copy of this software can be obtained from unity asset store only.
// // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// // FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
// // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// // THE SOFTWARE.

using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using DG.Tweening;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.FieldObjects
{
    public class Bouncing : MonoBehaviour
    {
        [SerializeField]
        private float speed = 2.0f;

        [SerializeField]
        private float maxX = 2.0f;
        [SerializeField]
        private float minX = -2.0f;
        [SerializeField]
        private float maxY = 2.0f;
        [SerializeField]
        private float minY = -2.0f;

        [SerializeField]
        private float yAmplitude = 0.5f;
        [SerializeField]
        private float frequency = 1f;
        [SerializeField]
        private float changeDirectionRate = 0.005f;
        [SerializeField]
        private float scaleScore = 1.1f;

        private int direction = 1;
        private Vector3 posOffset;
        private Vector3 tempPos;
        public GameObject visuals;
        private bool starAnim;
        private Vector3 _previousPosition;
        
        [SerializeField] private AudioClip bounceSound;
        private Animator animator;
        [SerializeField]
        private GameObject[] disableOnStart;
        private float lastBallTime = 0f; // Timestamp of the last processed ball
        private float ballCooldown = .3f; // Cooldown duration in seconds
        
        private void Awake()
        {
            animator = GetComponent<Animator>();
        }

        private void OnEnable()
        {
            starAnim = false;
            animator.SetTrigger("RandomFinished");
            changeDirectionRate = Random.Range(.001f, changeDirectionRate);
        }

        private void OnDisable()
        {
            foreach (var obj in disableOnStart)
            {
                obj.SetActive(false);
            }
        }

        private void OnCollisionEnter2D(Collision2D other)
        {
            if (other.gameObject.CompareTag("Ball"))
            {
                SoundBase.instance.PlaySound(SoundBase.instance.beeBzz);

                // Check if cooldown has passed
                if (Time.time < lastBallTime + ballCooldown)
                {
                    return; // Cooldown has not passed, so we return without processing the ball
                }

                // Cooldown has passed, so we process the ball and update the timestamp
                lastBallTime = Time.time;

                var ball = other.gameObject.GetComponent<Ball>();
                ball.scoreMultiplier++;
                ScoreAnimation(ball.GetScore());
                SoundBase.instance.PlaySound(bounceSound);
                animator.SetTrigger("Bounce");
            }
        }

        private void ScoreAnimation(int i)
        {
            ScoreManager.instance.AddScore(i, transform.position);
            visuals.transform.DOScale(scaleScore, .1f).SetLoops(2, LoopType.Yoyo);
        }

        void Update()
        {
            if (UnityEngine.Random.value < changeDirectionRate && starAnim)
            {
                Charge();
            }
            
            Vector3 directionV = Vector3.zero;
            if(transform.position != _previousPosition)
            {
                directionV = (transform.position - _previousPosition).normalized;
                _previousPosition = transform.position;
            }
            
            if(transform.localPosition.x > maxX) 
            {
                direction = -1;
            } 
            else if (transform.localPosition.x < minX) 
            {
                direction = 1;
            }

            Vector3 moveDirection = new Vector3(direction, 0, 0);
            transform.localPosition += moveDirection * (speed * Time.deltaTime);

            if (directionV.x > 0)
            {
                transform.localScale = new Vector3(Mathf.Abs(transform.localScale.x), transform.localScale.y, transform.localScale.z);
            }
            else
            {
                transform.localScale = new Vector3(-Mathf.Abs(transform.localScale.x), transform.localScale.y, transform.localScale.z);
            }
            if (!starAnim) return;

            tempPos = transform.localPosition;
            tempPos.y = posOffset.y + Mathf.Sin(Time.fixedTime * Mathf.PI * frequency) * yAmplitude;

            transform.localPosition = tempPos;
        }

        public void Begin()
        {
            starAnim = false;
            float startingY = Random.Range(minY, maxY);
            var startingX = Random.Range(minX, maxX);   
            transform.DOLocalMove( new Vector3(startingX,startingY, 0)  , 1).SetEase(Ease.OutQuad).OnComplete(BeginAnim);
        }

        private void Charge()
        {
            starAnim = false;

            float minDistance = 2f; 

            float randomX = Random.Range(minX, maxX) + Mathf.Sign(Random.Range(-1f, 1f)) * minDistance;
            float randomY = Random.Range(minY, maxY) + Mathf.Sign(Random.Range(-1f, 1f)) * minDistance; 

            // Clamping the coordinates within specified bounds
            randomX = Mathf.Clamp(randomX, minX, maxX);
            randomY = Mathf.Clamp(randomY, minY, maxY);

            Vector3 newPos = new Vector3(randomX, randomY, 0);

            transform.DOLocalMove(newPos, .5f).SetEase(Ease.OutQuad).OnComplete(BeginAnim);
        }
        
        public void Remove()
        {
            transform.DOKill();
            starAnim = false;
            float startingX = Random.Range(0, 2) == 0 ? -10f : 10f;
            transform.DOLocalMoveX(startingX, 2f).SetEase(Ease.OutQuad).OnComplete(() => PoolObject.Return(gameObject));
        }

        private void BeginAnim()
        {
            starAnim = true;
            posOffset = transform.localPosition;
        }
    }


}
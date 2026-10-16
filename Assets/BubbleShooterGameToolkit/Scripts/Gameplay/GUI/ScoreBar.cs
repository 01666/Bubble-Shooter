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

using System;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.Gameplay.Targets;
using DG.Tweening;
using UnityEngine;
using UnityEngine.UI;
using Random = UnityEngine.Random;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.GUI
{
    /// Score bar class to show the progress of the score and stars
    public class ScoreBar : MonoBehaviour
    {
        [SerializeField] private Slider slider;
        [SerializeField] private Transform[] starsContainer = new Transform[3];
        [SerializeField] private Transform[] starPlaceholders = new Transform[3];
        [SerializeField] private GameObject[] stars = new GameObject[3];
        [SerializeField] private GameObject starPrefab;
        [SerializeField] private GameObject raysPrefab;
        [SerializeField] private ParticleSystem starEffectPrefab;
        
        private int[] _starScore = Array.Empty<int>();
        private bool[] _starsActivated = new bool[3];

        public void InitProgress(int[] starScore)
        {
            _starScore = starScore;
            slider.maxValue = starScore.Last() * 1.15f;
            float width = starsContainer[2].transform.localPosition.x - slider.GetComponent<RectTransform>().rect.xMin;

            for (int i = 0; i < 2; i++)
            {
                float xPos = slider.GetComponent<RectTransform>().rect.xMin + width * (starScore[i] / (float)starScore[2]);
                starsContainer[i].localPosition = new Vector3(xPos, starsContainer[i].localPosition.y, 0);
            }

            foreach (var star in stars)
            {
                star.SetActive(false);
            }
        }
        public void UpdateProgress(int score)
        {
            slider.value = score;
            ActivateStar(score);
        }

        private void ActivateStar(int score)
        {
            for (int i = 0; i < _starScore.Length; i++)
            {
                if (_starScore[i] <= score && !_starsActivated[i])
                {
                    _starsActivated[i] = true;
                    var starGUI = stars[i];
                    var starAnimation = PoolObject.GetObject(starPrefab);
                    starAnimation.transform.position = (Vector2)GameCamera.instance.transform.position + Random.insideUnitCircle * 0.1f;
                    starAnimation.GetComponentInChildren<TrailRenderer>().Clear();
                    starAnimation.GetComponent<Animator>().enabled = true;
                    SoundBase.instance.PlaySound(SoundBase.instance.getStar);
                    SoundBase.instance.PlayDelayed(SoundBase.instance.swish[1],1.5f);
                    DOVirtual.DelayedCall(1.2f, () => AnimateStar(starAnimation, starGUI.transform.position, () =>
                    {
                        starGUI.SetActive(true);
                        var fx = PoolObject.GetObject(starEffectPrefab.gameObject);
                        fx.transform.position = starGUI.transform.position;
                        EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.StarActivated).Invoke(new BallCollectEventArgs(starAnimation.GetComponent<Targetable>()));
                        PoolObject.Return(starAnimation);
                    }));
                }
            }
        }

        private void AnimateStar(GameObject star, Vector3 targetPos, Action callBack)
        {
            star.GetComponent<Animator>().enabled = false;
            var sq = DOTween.Sequence();
            var duration = 0.5f;
            sq.Append(star.transform.DORotate(new Vector3(0, 0, 1000), duration, RotateMode.FastBeyond360));
            sq.Join(star.transform.DOScale(.5f, duration));
            sq.Join(star.transform.DOMove(targetPos, duration).SetEase(Ease.InBack));
            sq.OnComplete(() => callBack?.Invoke());
        }
    }
}
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
using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.CommonUI.Labels;
using DG.Tweening;
using TMPro;
using UnityEngine;
using UnityEngine.Assertions;
using Random = UnityEngine.Random;

namespace BubbleShooterGameToolkit.Scripts.CommonUI
{
    public class TopPanel : MonoBehaviour
    {
        private Tweener doPunchScale;

        [SerializeField]
        private CoinsLabel coinsLabel;

        [SerializeField]
        private LifeLabel lifeLabel;
        
        [SerializeField]
        private TextMeshProUGUI coisTextPrefab;

        [SerializeField]
        private GameObject fxPrefab;

        private void Awake()
        {
            Assert.IsNotNull(coinsLabel, "coins label is null");
            Assert.IsNotNull(lifeLabel, "life label is null");
            Assert.IsNotNull(coisTextPrefab, "coins text prefab is null");
        }


        public void AnimateCoins(Vector3 startPosition, string rewardDataCount, Action callBack)
        {
            Animate(fxPrefab, SoundBase.instance.coins, coinsLabel, startPosition, rewardDataCount, callBack);
        }

        public void AnimateLife(Vector3 startPosition, string rewardDataCount, Action callBack)
        {
            Animate(fxPrefab, SoundBase.instance.heats, lifeLabel, startPosition, rewardDataCount, callBack);
        }

        private void Animate(GameObject fxPrefab, AudioClip sound,
            Label label,
            Vector3 startPosition, string rewardDataCount,
            Action callBack)
        {
            int count = 0;
            var animateCount = 4;
            
            var targetTransform = label.transform;
            var targetPosition = label.icon.transform.position;

            PopupText(startPosition, rewardDataCount);

            for (var i = 0; i < animateCount; i++)
            {
                var item = Instantiate(label.icon, transform);
                var random = .5f;
                item.transform.SetParent(transform);
                item.transform.position = startPosition + new Vector3(Random.Range(-random, random), Random.Range(-random, random));
                StartAnim(item.transform, targetPosition, () =>
                {
                    if (doPunchScale == null || !doPunchScale?.IsPlaying() == true)
                    {
                        var punchScale = targetTransform.DOPunchScale(Vector3.one * 0.2f, 0.2f);
                        punchScale.OnComplete(() => { doPunchScale = null; });
                        doPunchScale = punchScale;
                    }

                    var fx = Instantiate(fxPrefab, transform);
                    fx.transform.localScale = Vector3.one;
                    fx.transform.position = targetPosition;
                    if (count == 0)
                        SoundBase.instance.PlaySound(sound);

                    count++;
                    if (count == animateCount)
                    {
                        transform.localScale = Vector3.one;
                        DOVirtual.DelayedCall(.5f, () =>
                        {
                            callBack?.Invoke();
                            DOTween.Kill(gameObject);
                        });
                    }
                });
            }
        }

        private void PopupText(Vector3 transformPosition, string rewardDataCount)
        {
            var coinsText = Instantiate(coisTextPrefab, transform.parent);
            coinsText.transform.position = transformPosition;
            coinsText.text = rewardDataCount;
            coinsText.alpha = 0; // init alpha

            // animate text alpha up, then alpha down and fly up at the same time
            var sequence = DOTween.Sequence();
            sequence.Append(coinsText.DOFade(1, 0.5f));
            sequence.Join(coinsText.transform.DOMoveY(coinsText.transform.position.y + .5f, 1f)).OnComplete(() =>
            {
                Destroy(coinsText.gameObject);
            });
            sequence.Append(coinsText.DOFade(0, 0.5f));
        }
        
        public void StartAnim(Transform targetTransform, Vector3 targetPos, Action callback = null)
        {
            float randomStartDelay = UnityEngine.Random.Range(0f, 0.5f);
            // sequence of tweens
            var sequence = DOTween.Sequence();
            
            // appear and scale up
            targetTransform.localScale = Vector3.zero;
            var _scaleTween = targetTransform.DOScale(Vector3.one * 1f, .5f)
                .SetEase(Ease.OutBack)
                .SetDelay(randomStartDelay);

            sequence.Append(_scaleTween);
            var _rotationTween = targetTransform.DORotate(new Vector3(0, 0, UnityEngine.Random.Range(0, 360)), .3f, RotateMode.FastBeyond360)
                .SetEase(Ease.Linear)
                .SetLoops(1, LoopType.Incremental);
            
            sequence.Join(_rotationTween);
            
            // Moves the object from its current position to the particular position over time
            var _movementTween = targetTransform.DOMove(targetPos, .3f)
                .SetEase(Ease.Linear)
                .OnComplete(() => 
                {
                    callback?.Invoke();
                    targetTransform.gameObject.SetActive(false);
                });
            
            sequence.Join(_movementTween);
            sequence.Play();
        }
    }
}
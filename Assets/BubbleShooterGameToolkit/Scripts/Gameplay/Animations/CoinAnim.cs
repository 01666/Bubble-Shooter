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
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using DG.Tweening;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Animations
{
    public class CoinAnim : MonoBehaviour
    {

        private Action _callback;
        private Sequence sequence;

        public void StartAnim(Vector3 targetPos, Action callback = null)
        {
            _callback = callback;

            float randomStartDelay = UnityEngine.Random.Range(0f, 0.5f);
            // sequence of tweens
            sequence = DOTween.Sequence();
            
            // appear and scale up
            transform.localScale = Vector3.zero;
            var _scaleTween = transform.DOScale(Vector3.one * 1f, .5f)
                .SetEase(Ease.OutBack)
                .SetDelay(randomStartDelay);

            sequence.Append(_scaleTween);
            var _rotationTween = transform.DORotate(new Vector3(0, 0, UnityEngine.Random.Range(0, 360)), 1f, RotateMode.FastBeyond360)
                .SetEase(Ease.Linear)
                .SetLoops(5, LoopType.Incremental);

            sequence.Join(_rotationTween);
            
            // Moves the object from its current position to the particular position over time
            var _movementTween = transform.DOMove(targetPos, .3f)
                .SetEase(Ease.Linear)
                .OnComplete(() => 
                {
                    _callback?.Invoke();
                    PoolObject.Return(gameObject);
                });
            
            sequence.Join(_movementTween);
            sequence.Play();
        }

        private void OnDisable()
        {
            sequence?.Kill();
        }
    }
}
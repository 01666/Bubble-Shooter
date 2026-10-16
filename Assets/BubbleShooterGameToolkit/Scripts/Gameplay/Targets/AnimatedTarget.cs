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

using DG.Tweening;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Targets
{
    public class AnimatedTarget : AnimatedTargetBase
    {
        [SerializeField] private float delay = 1f;
        [SerializeField] private bool rotate = true;

        public override void Init(Vector3 startPosition, Vector3 targetPosition)
        {
            this.targetPosition = targetPosition;
            transform.position = startPosition;
            var a1 = transform.DOScale(Vector3.one * 2, .2f);
            var a2 = transform.DOMove(targetPosition, time).SetEase(Ease.InOutBack).OnComplete(OnCompleted);
            var a3 = transform.DOScale(Vector3.one, .5f);
            if(rotate)
                transform.DORotate(Vector3.back * 1000, time * 2);
            var sequence = DOTween.Sequence();
            //delay before animation
            sequence.Append(a1);
            sequence.AppendInterval(delay);
            sequence.Append(a2);
            sequence.Append(a3);
            sequence.Play();
        }
    }
}
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

using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Targets
{
    public class AnimatedTargetBase : MonoBehaviour
    {
        protected Animator animator;
        protected Vector3 targetPosition;
        protected virtual float time => .5f;

        public virtual void Init(Vector3 startPosition, Vector3 targetPosition)
        {
            this.targetPosition = targetPosition;
            animator = GetComponent<Animator>();
            transform.position = startPosition;
            GroupAnimationManager.instance.Animate(
                transform,
                time,
                GetTargetPosition(),
                Quaternion.identity,
                true,
                OnCompleted);
        }
        
        public virtual Vector3 GetTargetPosition()
        {
            return transform.parent.InverseTransformPoint(targetPosition);
        }

        public virtual void OnCompleted()
        {
            ReturnToPool();
        }

        protected void ReturnToPool()
        {
            PoolObject.Return(gameObject);
        }
    }
}
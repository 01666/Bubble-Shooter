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

using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Targets
{
    public class ExtraItemAnimation : AnimatedTargetBase
    {
        protected override float time => 1;

        public override void Init(Vector3 startPosition, Vector3 targetPosition)
        {
            base.Init(startPosition, targetPosition);
            transform.GetChild(0).gameObject.SetActive(true);
            animator.Rebind();
            animator.SetTrigger("Count");
        }

        private void Update()
        {
            // for every child of the game object
            foreach(Transform child in transform)
            {
                Vector3 direction = targetPosition - child.position;
                float angle = Mathf.Atan2(direction.y, direction.x) * Mathf.Rad2Deg - 90; // assuming the sprite is facing up at 0 degrees
                Quaternion targetRotation = Quaternion.Euler(0, 0, angle);
                child.rotation = targetRotation;
            }
        }
        
        public override void OnCompleted()
        {
            transform.GetChild(0).gameObject.SetActive(false);
            Invoke(nameof(base.OnCompleted), 1);
        }
    }
}
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

using System.Collections;
using BubbleShooterGameToolkit.Scripts.Utils;
using UnityEngine;
using UnityEngine.Rendering;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types
{
    class Collapsar : AbsorbingBall
    {
        [SerializeField]
        private int hp = 5;
        [SerializeField]
        private SpriteRenderer spriteCircle;

        public override void OnDirectlyTouched(Ball touchedByBall)
        {
            base.OnDirectlyTouched(touchedByBall);
            touchedByBall.Flags &= ~EBallFlags.Pinned;
            StartCoroutine(AnimateAbsorbingBall(touchedByBall));
        }

        private IEnumerator AnimateAbsorbingBall(Ball touchedByBall)
        {
            var sortingGroup = touchedByBall.gameObject.AddComponentIfNotExists<SortingGroup>();
            sortingGroup.sortingOrder = 5;
            touchedByBall.BallColliderHandler.DisableCollider();

            Vector3 center = this.transform.position;
            float initialRadius = Vector3.Distance(center, touchedByBall.transform.position);

            // Calculate the initial angle based on the current ball position
            Vector3 dir = touchedByBall.transform.position - center;
            float initialAngle = Mathf.Atan2(dir.y, dir.x);

            float numberOfRotations = 1f; // increase for more rotations
            float totalDuration = 0.3f; // Total duration for the spiral movement in seconds
            float timer = 0.0f; // Incremental timer

            while (timer < totalDuration)
            {
                // check if the ball is disabled
                if (!touchedByBall.gameObject.activeSelf)
                {
                    Destroy(sortingGroup);
                    yield break;
                }
                
                float t = timer / totalDuration; // normalize time to 0-1

                float angle = Mathf.Lerp(initialAngle, initialAngle - Mathf.PI * 2 * numberOfRotations, t);
                float radius = Mathf.Lerp(initialRadius, 0f, t);

                float x = center.x + radius * Mathf.Cos(angle);
                float y = center.y + radius * Mathf.Sin(angle);

                touchedByBall.transform.position = new Vector3(x, y, center.z);

                // Here's where we replace DoScale with Lerp
                touchedByBall.transform.localScale = Vector3.Lerp(touchedByBall.transform.localScale, Vector3.zero, 0.5f * Time.deltaTime);
                
                timer += Time.deltaTime;
                yield return null;
            }

            // Once the while loop is done, destroy sortingGroup and the ball
            Destroy(sortingGroup);
            touchedByBall.DestroyBall();
            if(touchedByBall)
            {
                hp--;
                if (hp > 0)
                {
                    spriteCircle.color = new Color(spriteCircle.color.r, spriteCircle.color.g, spriteCircle.color.b, 1f / (hp + 1));
                    yield break;
                }
            }

            DestroyBall();
        }
    }
}
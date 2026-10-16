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

namespace BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers
{
    /// a dot for aim line
    public class AimDot : MonoBehaviour
    {
        private Vector2 startPoint;
        private Vector2 nextPoint;
        public bool animate = true;
        [SerializeField]
        private SpriteRenderer spr;
        private float startTime;
        private float journeyLength;
        private float duration;
        private Vector3 targetScale;
        private float targetTime;
        public bool IsShow => spr.color.a >= 1f;
        private float fadeSpeed = 5f;
        private bool shouldBeVisible = false;

        public void SetColor(Color color)
        {
            spr.color = color;
        }

        public void Hide()
        {
            shouldBeVisible = false;
        }

        public void Show()
        {
            shouldBeVisible = true;
        }

        public void UpdateAnimation(Vector2 startPoint, Vector2 nextPoint)
        {
            this.startPoint = spr.transform.parent.InverseTransformPoint(startPoint);
            this.nextPoint = spr.transform.parent.InverseTransformPoint(nextPoint);
        }

        private void Update()
        {
            UpdateVisibility();

            if (!animate)
                return;
            
            spr.transform.localPosition = Vector2.MoveTowards(spr.transform.localPosition, nextPoint, Time.deltaTime * 5f);
            duration = .35f;
            if (startTime + duration < Time.time)
            {
                ReStartAnimation();
            }
            
            UpdateScaleAnimation();
        }

        private void ReStartAnimation()
        {
            spr.transform.localPosition = startPoint;
            startTime = Time.time;
        }

        public void SetScaleAnimation(Vector3 vector3, float prevScale)
        {
            spr.transform.localScale = new Vector3(prevScale, prevScale, 1);
            targetScale = vector3;
            targetTime = Time.time + duration;
        }
        
        private void UpdateScaleAnimation()
        {
            if (targetTime > Time.time)
            {
                // scale lerp animation in update
                float t = (Time.time - (targetTime - duration)) / duration;
                spr.transform.localScale = Vector3.Lerp(spr.transform.localScale, targetScale, t);
            }
        }
        
        private void UpdateVisibility()
        {
            float targetAlpha = shouldBeVisible ? 1 : 0;
            Color spriteColor = spr.color;
            spriteColor.a = Mathf.MoveTowards(spriteColor.a, targetAlpha, fadeSpeed * Time.deltaTime);
            spr.color = spriteColor;
        }
    }
}
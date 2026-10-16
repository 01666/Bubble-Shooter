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

using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Properties;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Covers
{
    ///script for objects that appears above a ball
    public class Cover : Attachable
    {
        [Header("Protect ball from destroying"), Tooltip("if true, ball will not be destroyed, cover will be destroyed instead")]
        public bool isProtectingBall = true;

        [Space(10)]
        public DestroyProperties destroyProperties;

        public override bool DestroyItem(BallDestructionOptions options)
        {
            base.DestroyItem(options);
            if (isProtectingBall)
            {
                ball.cover = null;
                ball.Uncover();
                return false;
            }

            return true;
        }
        
        public void AdjustSortingOrder(int y)
        {
            var spriteRenderers = GetComponentsInChildren<SpriteRenderer>();

            for (var i = 0; i < spriteRenderers.Length; i++)
            {
                var spriteRenderer = spriteRenderers[i];
                spriteRenderer.sortingOrder = y + i;
            }
        }
    }
}
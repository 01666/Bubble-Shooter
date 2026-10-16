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

using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels
{
    class ExtraItem : LabelItem
    {
        protected override void ChangeAttributes(Level obj)
        {
            base.ChangeAttributes(obj);
            if (ball.cover != null)
            {
                ball.cover.OnDestroy += DestroyThisItem;
            }
        }

        private void DestroyThisItem(BallDestructionOptions options)
        {
            DestroyItem(options);
        }

        public override bool DestroyItem(BallDestructionOptions options = null)
        {
            if (ball?.cover != null)
                ball.cover.OnDestroy -= DestroyThisItem;
            return base.DestroyItem(options);
        }

        public override void SetPosition(Vector3 transformPosition)
        {
            transform.position = ball.transform.position + new UnityEngine.Vector3(.2f, .2f, 0);
            transform.localRotation = UnityEngine.Quaternion.Euler(0, 0, 30);
        }
    }
}
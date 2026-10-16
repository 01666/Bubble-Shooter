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

using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.ExtraItems
{
    public class Multicolor : ColorBall
    {
        private int targetColor;

        public override void OnTouched(Ball touchedByBall)
        {
            base.OnTouched(touchedByBall);

            if (touchedByBall is ColorBall colorBall)
            {
                targetColor = colorBall.GetColor();
            }
        }
        
        public override bool CompareColor(int color)
        {
            return true;
        }

        public override int GetColor(ColorBall neighborBall)
        {
            if (neighborBall != null)
            {
                targetColor = neighborBall.GetColor();
            }

            return targetColor;
        }

        public override bool DestroyBall(BallDestructionOptions options = null)
        {
            Destroy(GetComponent<Rigidbody2D>());
            return base.DestroyBall(options);
        }
    }
}
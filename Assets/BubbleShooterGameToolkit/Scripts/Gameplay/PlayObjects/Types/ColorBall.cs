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
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types
{
    public class ColorBall : Ball
    {
        [SerializeField]
        protected int color;

        private Sprite sprite;
        private Color colorForAim;

        public override void OnEnable()
        {
            base.OnEnable();
            colorForAim = GameManager.instance.GameplaySettings.ballColors[color];
        }

        public override void SetPosition(Vector2Int pos)
        {
            base.SetPosition(pos);
            ColorManager.instance.AddColor(color);
        }

        public override Color GetColorForAim()
        {
            return colorForAim;
        }

        public virtual int GetColor(ColorBall neighborBall = null)
        {
            return color;
        }
        
        public virtual bool CompareColor(int color)
        {
            return this.color == color;
        }

        public override void Fall()
        {
            base.Fall();
            ColorManager.instance.RemoveColor(color);
        }

        public override bool DestroyBall(BallDestructionOptions options = null)
        {
            bool falling = Flags.HasFlag(EBallFlags.Falling);
            var destroyBall = base.DestroyBall(options);
            if(destroyBall && !falling)
                ColorManager.instance.RemoveColor(color);
            return destroyBall;
        }
    }
}
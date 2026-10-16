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
using BubbleShooterGameToolkit.Scripts.LevelSystem;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels
{
    public class LabelItem : Attachable
    {
        public override void OnEnable()
        {
            base.OnEnable();
            EventManager.GetEvent<Level>(EGameEvent.LevelLoaded).Subscribe(ChangeAttributes);
        }
        
        public override void OnDisable()
        {
            base.OnDisable();
            EventManager.GetEvent<Level>(EGameEvent.LevelLoaded).Unsubscribe(ChangeAttributes);
        }

        protected virtual void ChangeAttributes(Level obj)
        {
        }

        public override void OnTouched(Ball touchedByBall, Ball thisBall)
        {
            base.OnTouched(touchedByBall, thisBall);
            DestroyItem();
        }

        public override bool DestroyItem(BallDestructionOptions options = null)
        {
            ball.label = null;
            return base.DestroyItem(options);
        }
    }
}
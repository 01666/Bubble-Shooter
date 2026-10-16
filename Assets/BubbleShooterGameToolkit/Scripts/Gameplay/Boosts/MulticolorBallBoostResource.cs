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
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Settings;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Boosts
{
    public class MulticolorBallBoostResource : BoostResource
    {
        public override bool Activate(BoostParameters parameters)
        {
            if (!base.Activate(parameters)) return false;
            EventManager.GetEvent<(Ball,Ball)>(EGameEvent.BallStopped).Subscribe(OnBallStopped);

            return true;
        }

        private void OnBallStopped((Ball, Ball) valueTuple)
        {   
            EventManager.GetEvent<(Ball,Ball)>(EGameEvent.BallStopped).Unsubscribe(OnBallStopped);
            EventManager.GetEvent<BoostResource>(EGameEvent.BoostDeactivated).Invoke(this);
        }
    }
}
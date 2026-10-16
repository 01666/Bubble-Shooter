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

using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.ExtraItems
{
    public abstract class ExplosiveBall : Ball
    {
        [SerializeField]
        protected GameObject explosionFXBubble;
        [SerializeField]
        protected AudioClip explosionBubbleSound; 
        [SerializeField]
        protected AudioClip activateSound;

        private bool activated;

        public abstract Ball[] GetAffectedBalls();
        protected abstract void Activate();

        public override void OnEnable()
        {
            base.OnEnable();
            activated = false;
            ballSoundable = new BallSoundBomb();
        }
        
        public override bool DestroyBall(BallDestructionOptions options = null)
        {
            if(ballDestruction.CanDestroyNow())
            {
                options ??= new BallDestructionOptions();
                if (!activated)
                {
                    ballSoundable.PlayExplosionSound(activateSound);

                    activated = true;
                    Activate();
                }
            }

            return base.DestroyBall(options);
        }

        public void OnFinished()
        {
            EventManager.GetEvent(EGameEvent.CheckSeparatedBalls).Invoke();
        }
    }
}
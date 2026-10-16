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

using System;
using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.Gameplay.Targets;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels
{
    public class Attachable : Targetable
    {
        public virtual Ball ball { get; set; }
        public Action<BallDestructionOptions> OnDestroy;
        protected BallSound ballSoundable;

        public virtual void OnTouched(Ball touchedByBall, Ball thisBall)
        { }

        public virtual bool DestroyItem(BallDestructionOptions options = null)
        {
            options ??= new BallDestructionOptions();
            if(!options.NoFX)
                PlayFX();
            if(!options.NoSound)
                ballSoundable.PlayExplosionSound(audioProperties.destroySound);
            OnDestroy?.Invoke(options);
            RestoreParent();
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.ItemDestroyed).Invoke(new BallCollectEventArgs(this, options.DestroyedBy));
            if (!TargetManager.instance.IsTarget(this))
            {
                PoolObject.Return(gameObject);
            }
            return true;
        }

        protected void PlayFX()
        {
            if(fxPrefab)
                PoolObject.GetObject(fxPrefab).transform.position = transform.position;
        }

        public override void OnEnable()
        {
            ball ??= GetComponentInParent<Ball>();
            ballSoundable = new BallSound();
        }

        public virtual void OnDisable()
        { }

        public virtual void SetPosition(Vector3 transformPosition)
        {
            transform.position = transformPosition;
        }
    }
}
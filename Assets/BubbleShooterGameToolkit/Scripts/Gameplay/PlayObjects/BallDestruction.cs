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

using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.ExtraItems;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using DG.Tweening;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects
{
    public class BallDestruction
    {
        private readonly Ball ball;
        private readonly GameObject fxPrefab;

        public BallDestruction(Ball ball, GameObject fxPrefab)
        {
            this.ball = ball;
            this.fxPrefab = fxPrefab;
        }

        public virtual bool DestroyBall(BallDestructionOptions options = null)
        {
            options ??= new BallDestructionOptions();
            if(ball.Flags.HasFlag(EBallFlags.Destroying)) return false;
            if (ball.cover != null)
            {
                bool stillProtected = !ball.cover.DestroyItem(options);
                if (stillProtected)
                {
                    if(options is { FXPrefab: not null, NoFX: false } && options.FXPrefab != ball.fxPrefab && options.DestroyedBy is ExplosiveBall)
                        PlayExplosionFX(options.FXPrefab ?? ball.fxPrefab);
                    ball.Flags &= ~EBallFlags.MarkedForDestroy;
                    if(!ball.Flags.HasFlag(EBallFlags.Falling))  // allow to destroy falling balls even if they are protected
                        return false;
                }
            }

            ball.Flags |= EBallFlags.Destroying;

            CommondDestructionTasks();

            ball.OnDestroy?.Invoke(options);

            ball.Flags &= ~EBallFlags.Pinned;
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.ItemDestroyed).Invoke(new BallCollectEventArgs(ball, options.DestroyedBy));
            if(!options.NoFX)
                PlayExplosionFX(options.FXPrefab ?? ball.fxPrefab);
            
            if (!options.NoSound)
                ball.ballSoundable.PlayExplosionSound(options.DestroySound ?? ball.audioProperties.destroySound);
            
            if (!options.NoScore)
                ScoreManager.instance.AddScore(ball.GetScore(), ball.transform.position, EventManager.GameStatus == EStatus.Play);
            if(!options.DisableScale)
            {
                ball.transform.DOScale(0, 0.2f).OnComplete(ball.DisableAndReturnToPool);
            }
            else
                ball.DisableAndReturnToPool();
            return true;
        }

        public void CommondDestructionTasks()
        {
            ball.label?.DestroyItem();
            ball.hidden?.DestroyItem();
            ball.levelManager.LevelGridManager.RemoveBall(ball);
            LevelUtils.UpdateNeighbours(ball);
        }

        public GameObject PlayExplosionFX(GameObject fxPrefab = null)
        {
            fxPrefab ??= this.fxPrefab;
            GameObject fx = null;
            if (fxPrefab != null)
            {
                fx = PoolObject.GetObject(fxPrefab);
                fx.transform.position = ball.transform.position;
            }

            return fx;
        }
        
        // Check can ball be destroyed, i.e. it can be destroyed if it is not protected by cover
        public bool CanDestroyNow()
        {
            return (!ball.cover?.isProtectingBall ?? true) || ball.HasFlag(EBallFlags.Falling);
        }
    }
}
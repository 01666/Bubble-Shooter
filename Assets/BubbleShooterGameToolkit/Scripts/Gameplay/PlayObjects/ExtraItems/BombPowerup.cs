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

using System.Linq;
using BubbleShooterGameToolkit.Scripts.Gameplay.Animations;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using DG.Tweening;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.ExtraItems
{
    public class BombPowerup : ExplosiveBall
    {
        private bool firstState;
        private bool secondState;

        public override bool DestroyBall(BallDestructionOptions options = null)
        {
            options ??= new BallDestructionOptions();
            options.FXPrefab = fxPrefab;
            options.DestroyedBy = this;
            return base.DestroyBall(options);
        }

        public override Ball[] GetAffectedBalls()
        {
            var collider2Ds = new Collider2D[20];
            LevelUtils.GetCollidersAround(transform.position, collider2Ds, 3f);
            return collider2Ds.Where(collider2D => collider2D != null).Select(collider2D => collider2D.GetComponent<Ball>()).Where(ball => ball != null && ball.DestroyProperties.destroyByExplosion && ball != this).ToArray();
        }

        protected override void Activate()
        {
            WaveEffectProcessor.instance.AnimateWaveEffect(this, transform.position+ Vector3.up * 0.5f, 5, 0.3f, 0.1f, .01f, .1f);

            var bubbleLayers = LevelUtils.GetExtendedNeighbours<Ball>(this, 2, filterBall => filterBall != null && filterBall != this && !filterBall.Flags.HasFlag(EBallFlags.MarkedForDestroy)).ToArray();

            foreach (var bubbleLayer in bubbleLayers)
            {
                ScoreManager.instance.CheckMultiplier(bubbleLayer.ToArray());
                foreach (var ball in bubbleLayer)
                {
                    if (ball != null && ball.DestroyProperties.destroyByExplosion)
                    {
                        ball.Flags |= EBallFlags.MarkedForDestroy;
                    }
                }
            }

            var sequence = DOTween.Sequence();
            sequence.AppendInterval(.1f);
            // iterate through all layers
            for (var i = 0; i < bubbleLayers.Length; i++)
            {
                var layer = bubbleLayers[i];
                foreach (var ball in layer)
                {
                    if (ball != null && ball.DestroyProperties.destroyByExplosion)
                    {
                        sequence.AppendInterval(.05f);
                        var ballDestructionOptions = new BallDestructionOptions();
                        ballDestructionOptions.DestroyedBy = this;
                        ballDestructionOptions.FXPrefab = explosionFXBubble;
                        sequence.AppendCallback(() => ball.DestroyBall(ballDestructionOptions));
                    }
                }
                sequence.AppendInterval(.01f);
            }
            sequence.AppendInterval(0.1f);
            sequence.AppendCallback(OnFinished);
        }
    }
}
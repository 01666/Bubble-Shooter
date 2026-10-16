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

#region

using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEngine;

#endregion

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Hidden
{
    ///  item like a web, which holds ball
    public class Holder : Attachable
    {
        private readonly List<HolderPart> holdingParts = new();

        public override void OnEnable()
        {
            base.OnEnable();
            EventManager.GetEvent<Level>(EGameEvent.LevelLoaded).Subscribe(OnLoadedLevel);
        }
        
        public override void OnDisable()
        {
            base.OnDisable();
            EventManager.GetEvent<Level>(EGameEvent.LevelLoaded).Unsubscribe(OnLoadedLevel);
            UnSubscribe(ball);
        }
        
        private void OnTouched(Ball touchedByBall)
        {
            SpreadHolding();
        }

        private void OnLoadedLevel(Level obj)
        {
            ball.Flags |= EBallFlags.Root;
            Subscribe(ball);
            SpreadHolding();
            ball.OnTouch += OnTouched;
        }

        private void SpreadHolding()
        {
            var ballsHolded = FindObjectsOfType<Holder>().Select(i => i.ball).ToList(); 
            var neighbours = LevelUtils.GetNeighboursInit<Ball>(ball);
            for (int i = 0; i < neighbours.Length; i++)
            {
                if (neighbours[i] != null && !ballsHolded.Contains(neighbours[i]))
                {
                    var holdingPart = PoolObject.GetObject("HolderPart").GetComponent<HolderPart>();
                    holdingPart.transform.position = LevelUtils.PosToWorld(neighbours[i].position);

                    Vector3 directionToCenter = (transform.position - holdingPart.transform.position).normalized;
                    holdingPart.transform.up = directionToCenter;
                    holdingPart.transform.Rotate(0, 0, 90);
                    holdingPart.transform.position += directionToCenter * 0.45f;
                    holdingParts.Add(holdingPart);
                    holdingPart.Subscribe(neighbours[i]);
                }
            }
        }
        
        // subscribe to ball destroy event
        public void Subscribe(Ball ball)
        {
            ball.OnDestroy += OnBallDestroy;

            this.ball = ball;
        }

        // unsubscribe from ball destroy event
        protected void UnSubscribe(Ball ball)
        {
            ball.OnDestroy -= OnBallDestroy;
            ball.OnTouch -= OnTouched;
        }

        private void OnBallDestroy(BallDestructionOptions options)
        {
            DestroyItem(options);
        }

        public override bool DestroyItem(BallDestructionOptions options)
        {
            UnSubscribe(ball);
            ball.Flags &= ~EBallFlags.Root;
            foreach (var holdingPart in holdingParts)
            {
                holdingPart.DestroyItem(options);
            }
            return base.DestroyItem(options);
        }

    }
}
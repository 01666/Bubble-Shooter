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
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.Gameplay.Animations;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.ExtraItems;
using DG.Tweening;
using UnityEngine;
using Object = UnityEngine.Object;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    public class DestroyManager
    {
        public List<Ball> ballsToDestroy = new();
        private List<ExplosiveBall> explosiveBalls = new();
        private int scoreMultiplier;
        private Ball directlyTouchedBall;

        public DestroyManager()
        {
            EventManager.GetEvent<object>(EGameEvent.ToDestroy).Subscribe(ToDestroy);
        }

        private void ToDestroy(object data)
        {
            if(data is Ball ball)
            {
                ball.IgnoreRaycast();
                ballsToDestroy.Add(ball);
            }
            else if(data is List<Ball> balls)
            {
                foreach (var ball1 in balls)
                {
                    ball1.IgnoreRaycast();
                    ballsToDestroy.Add(ball1);
                }
            }
        }

        public IEnumerator DestroyBalls(Ball ballLaunched, LevelManager levelManager, SeparatingBallManager separatingBallManager)
        {
            ballsToDestroy = ballsToDestroy.Distinct().ToList();
            // get all balls with ExtraScore label and sum their scoreMultiplier
            scoreMultiplier = ballsToDestroy.Where(b => b.label is ExtraScore).Sum(b => ((ExtraScore)b.label).scoreMultiplier);
            scoreMultiplier = Mathf.Max(1, scoreMultiplier);
            ScoreManager.instance.SetMultiplier(scoreMultiplier);
            HashSet<Ball> waitingList = new HashSet<Ball>();
            waitingList.UnionWith(ballsToDestroy);

            ballsToDestroy = ballsToDestroy.Where(i => i != null)
                .OrderBy(ball => !(ball is ExplosiveBall))
                .ThenBy(ball => Vector2.Distance(ball.position, ballLaunched.position))
                .ToList();
            var anyExplosive = ballsToDestroy.Any(b=>b is ExplosiveBall && b.cover == null);
            explosiveBalls = new List<ExplosiveBall>();
            if (anyExplosive)
            {
                // get explosives balls 
                explosiveBalls = GetExplosiveBalls(ballsToDestroy);
                // remove explosive balls from the list
                ballsToDestroy = ballsToDestroy.Where(b => b is not ExplosiveBall).ToList();
                // remove balls affected by explosive balls
                foreach (var explosiveBall in explosiveBalls)
                {
                    var affectedBalls = explosiveBall.GetAffectedBalls();
                    ballsToDestroy = ballsToDestroy.Where(b => !affectedBalls.Contains(b)).ToList();
                }
            }
            foreach (var ball in ballsToDestroy)
            {
                if (ball == null) continue;
                if (ball.Flags.HasFlag(EBallFlags.MarkedForDestroy)) continue;
                ball.Flags |= EBallFlags.MarkedForDestroy;
            }
            var count = ballsToDestroy.Count;
            levelManager.StartCoroutine(DestroyExplodableSequence(explosiveBalls, ballLaunched));
            
            yield return levelManager.StartCoroutine(DestroySimpleBalls(anyExplosive, ballLaunched));
            yield return new WaitWhile(() => waitingList.Any(i=>i.Flags.HasFlag(EBallFlags.MarkedForDestroy)));
            yield return new WaitForFixedUpdate();
            EventManager.GetEvent<int>(EGameEvent.BallsDestroyed).Invoke(count);

            waitingList.Clear();
            directlyTouchedBall = null;
            explosiveBalls.Clear();
        }

        private List<ExplosiveBall> GetExplosiveBalls(List<Ball> balls, List<ExplosiveBall> explosiveBalls = null)
        {
            explosiveBalls ??= new List<ExplosiveBall>();

            foreach (var ball in balls)
            {
                if (ball is ExplosiveBall explosiveBall && !explosiveBalls.Contains(explosiveBall))
                {
                    explosiveBalls.Add(explosiveBall);
                }
            }

            return explosiveBalls;
        }


        private IEnumerator DestroySimpleBalls(bool anyExplosive, Ball ballLaunched)
        {
            while (ballsToDestroy.Count > 0)
            {
                var ball = ballsToDestroy[0];
                // Remove the ball from the list
                ballsToDestroy.RemoveAt(0);
                // Check if ball is not null before using it
                if (ball != null && ball.gameObject.activeSelf)
                {
                    if (!anyExplosive || ball is not ExplosiveBall)
                    {
                        DestroyBall(ball, ballLaunched);
                    }
                }

                if (ballsToDestroy.Count > 20)
                    yield return new WaitForFixedUpdate();
                else
                    yield return new WaitForSeconds(.05f);
            }
        }

        private IEnumerator DestroyExplodableSequence(List<ExplosiveBall> explosiveBalls, Ball ballLaunched)
        {
            for (int i = 0; i < explosiveBalls.Count;)
            {
                var explosiveBall = explosiveBalls[i];
                explosiveBall.Flags |= EBallFlags.MarkedForDestroy;
                ballsToDestroy.Remove(explosiveBall);
                DestroyBall(explosiveBall, ballLaunched);
                yield return new WaitForSeconds(.1f);

                // Decrease the index after removing an item
                i++;
            }
        }

        public void DestroyInstantly(Ball ball, Ball ballLaunched = null)
        {
            DestroyBall(ball, ballLaunched);
        }

        private void DestroyBall(Ball ball, Ball ballLaunched = null)
        {
            var ballDestructionOptions = new BallDestructionOptions();
            ballDestructionOptions.DestroyedBy = ballLaunched;
            ball?.DestroyBall(ballDestructionOptions);
        }
        
        public List<Ball> GetBallsToDestroy()
        {
            return ballsToDestroy;
        }
        
        // destroying a component
        public void DestroyComponent<T>(T component, Action callback) where T : Component
        {
            if (component == null) return;
            
            Object.Destroy(component);

            DOVirtual.DelayedCall(.1f, () => 
            { 
                callback?.Invoke(); 
            });
        }

        public bool AnyToDestroy()
        {
            return ballsToDestroy.Count > 0 || GetExplosiveBalls(ballsToDestroy).Count > 0 || directlyTouchedBall != null;
        }
        
        /// condition to add combo counter        
        public bool AnyExplosiveToDestroy()
        {
            return GetExplosiveBalls(ballsToDestroy).Count > 0;
        }
    }
}
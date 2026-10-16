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

using System.Collections;
using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEngine;
using Random = UnityEngine.Random;

#endregion

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels
{
    public class RandomDesctructorManager : MonoBehaviour
    {
        [SerializeField]
        private int offspringsNum = 2;
        private Dictionary<Ball, RandomDestructorOffspring> chosenBalls = new();

        private void OnEnable()
        {
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.ItemDestroyed).Subscribe(OnItemDestroyed);
        }

        private void OnDisable()
        {
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.ItemDestroyed).Unsubscribe(OnItemDestroyed);
        }

        private void OnItemDestroyed(BallCollectEventArgs ballCollectEventArgs)
        {
            if (EventManager.GameStatus != EStatus.Play)
                return;
            if (ballCollectEventArgs.targetObject is RandomDestructor)
            {
                for (var i = 0; i < offspringsNum; i++)
                {
                    var offspring = PoolObject.GetObject("RandomDestructorOffspring").GetComponent<RandomDestructorOffspring>();
                    offspring.Init(ballCollectEventArgs.targetObject.transform.position, this);
                    StartCoroutine(GetRandomTargetBalls(offspring));
                }
            }
        }

        private IEnumerator GetRandomTargetBalls(RandomDestructorOffspring offspring)
        {
            yield return new WaitForSeconds(Random.Range(.3f, .5f));
            offspring.StartFly();
        }

        public Ball GetTarget(RandomDestructorOffspring offspring, Vector3 transformPosition)
        {
            var collider2Ds = new Collider2D[100];
            LevelUtils.GetCollidersAround(transformPosition, collider2Ds, 10f);
            var balls = collider2Ds.Where(collider2D => collider2D != null).Select(collider2D => collider2D.GetComponent<Ball>()).Where(
                ball =>
                    ball != null && ball.gameObject.activeSelf && ball.IsValid() && ball is not AbsorbingBall && ball.transform.position.y < GameCamera.instance.topPivotUI.transform.position.y &&
                    ball is not CenterRotationBall && ball.Flags.HasFlag(EBallFlags.None)).Distinct().ToArray();

            if (balls.Length == 0)
            {
                offspring.OnFinished();
                return null;
            }
            
            balls = Shuffle(balls);
            foreach (var ball in balls)
            {
                if (chosenBalls.TryAdd(ball, offspring))
                {
                    return ball;
                }
            }
            return null;
        }

        private Ball[] Shuffle(Ball[] balls)
        {
            int n = balls.Length;
            while (n > 1)
            {
                n--;
                int k = Random.Range(0, n + 1);
                (balls[k], balls[n]) = (balls[n], balls[k]);
            }

            return balls;
        }
    }
}
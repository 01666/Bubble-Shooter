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
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Utils;
using UnityEngine;
using UnityEngine.Assertions;
using UnityEngine.Rendering;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers
{
    /// Throws balls
    public class LaunchContainer : BallContainerBase
    {
        public BallContainerSpawn ballContainerSpawn;
        private Ball ballAnimated;
        private Vector2Int newBallPos;

        private void Update()
        {
            if (EventManager.GameStatus != EStatus.Play && EventManager.GameStatus != EStatus.Win && EventManager.GameStatus != EStatus.Tutorial)
                return;

            if (BallCharged == null)
            {
                if(savedBall != null)
                {
                    BallCharged = savedBall;
                    var sortingGroup = BallCharged.gameObject.AddComponentIfNotExists<SortingGroup>();
                    sortingGroup.sortingOrder = 0;
                    savedBall = null;
                }
                else
                {
                    if (ballContainerSpawn.BallCharged != null)
                    {
                        ballAnimated = ballContainerSpawn.BallCharged;
                        SwitchBall(ballContainerSpawn, this, ballAnimated);
                        BallCharged = ballAnimated;
                        ballContainerSpawn.BallCharged = null;
                    }
                }
            }
        }

        public void SaveBall()
        {
            // save ball for next move
            if (BallCharged != null)
            {
                savedBall = BallCharged;
            }
        }

        public void LaunchBall(RaycastData raycastData)
        {
            if (BallCharged == null || switchCoroutine != null)
                return;
            if (MovesTimeManager.instance.GetMoves() == 0 && EventManager.GameStatus != EStatus.Win)
                return;

            var ballMovement = BallCharged.gameObject.AddComponentIfNotExists<BallLaunch>();
            if (ballMovement.launched)
                return;

            ballMovement.ball = BallCharged;
            ballMovement.Launch(raycastData);

            OnBallLaunched?.Invoke(BallCharged);
            BallCharged = null;
        }
    }
}
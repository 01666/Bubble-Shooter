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
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers
{
    public class BallContainerSpawn : BallContainerBase
    {
        public BallContainerBase ballContainer;
        float spawnDelay = 0.5f;
        public string nextBallPrefabName;

        private void Update()
        {
            if(EventManager.GameStatus != EStatus.Play && EventManager.GameStatus != EStatus.Win && EventManager.GameStatus != EStatus.Tutorial)
                return;

            if (MovesTimeManager.instance != null && BallCharged == null)
            {
                if (MovesTimeManager.instance.GetMoves() > 1 || MovesTimeManager.instance.GetMoves() == 1 && !ballContainer.BallCharged)
                {
                    if (spawnDelay > 0)
                    {
                        spawnDelay -= Time.deltaTime;
                        return;
                    }
                    spawnDelay = 0.1f;
                    var generateColor = nextBallPrefabName == ""? "Ball " + ColorManager.instance.GenerateColor() : nextBallPrefabName;
                    nextBallPrefabName = "";
                    Spawn(generateColor);
                }
            }
        }

        public void SwitchBalls()
        {
            if (BallCharged != null && ballContainer.BallCharged != null)
            {
                OnBallSwitched?.Invoke(BallCharged);

                var cannonBallCharged = ballContainer.BallCharged;
                SwitchBall(this, ballContainer, BallCharged, (b) => ballContainer.BallCharged = b );
                ballContainer.SwitchBall(ballContainer, this, cannonBallCharged, (b)=> BallCharged = b);
            }
        }
    }
}
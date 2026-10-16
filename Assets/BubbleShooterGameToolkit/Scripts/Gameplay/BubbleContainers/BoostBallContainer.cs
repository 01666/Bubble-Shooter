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
using DG.Tweening;
using UnityEngine.Rendering;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers
{
    public class BoostBallContainer : BallContainerBase
    {
        public void ReleaseBoost(string prefab)
        {
            BallCharged = SpawnBall(prefab);

            if (BallCharged)
            {
                transform.DOKill();
                LevelManager.instance.launchContainer.SaveBall();
                var sortingGroup = BallCharged.gameObject.AddComponent<SortingGroup>();
                sortingGroup.sortingLayerName = "UI";
                SwitchBall(this, LevelManager.instance.launchContainer, BallCharged, (b)=> LevelManager.instance.launchContainer.BallCharged = b );
                BallCharged = null;
            }
        }
    }
}
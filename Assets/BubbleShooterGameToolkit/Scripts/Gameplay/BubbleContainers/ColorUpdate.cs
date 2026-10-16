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
    [RequireComponent(typeof(BallContainerBase))]
    public class ColorUpdate : MonoBehaviour
    {
        private BallContainerBase ballContainer;

        private void OnEnable()
        {
            ballContainer = GetComponent<BallContainerBase>();
            // Subscribe to the event
            EventManager.GetEvent<int>(EGameEvent.ColorRemoved).Subscribe(OnColorRemoved);
        }

        private void OnDisable()
        {
            // Unsubscribe from the event
            EventManager.GetEvent<int>(EGameEvent.ColorRemoved).Unsubscribe(OnColorRemoved);
        }

        private void OnColorRemoved(int color)
        {
            if (EventManager.GameStatus != EStatus.Win && LevelManager.instance.LevelGridManager.AnyBallExists())
            {
                if (ballContainer.GetColor() == color)
                {
                    ballContainer.ChangeColor();
                }
            }
        }
    }
}
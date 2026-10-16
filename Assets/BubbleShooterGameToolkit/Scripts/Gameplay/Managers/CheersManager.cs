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
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;
using Random = UnityEngine.Random;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    public class CheersManager : MonoBehaviour
    {
        private float lastCheersTime;
        private readonly int cheersCooldown = 10;

        private void OnEnable()
        {
            EventManager.GetEvent<int>(EGameEvent.BallsDestroyed).Subscribe(ShowCheers);
        }

        private void OnDisable()
        {
            EventManager.GetEvent<int>(EGameEvent.BallsDestroyed).Unsubscribe(ShowCheers);
        }

        private void Update()
        {
            lastCheersTime -= Time.deltaTime;
        }

        private void ShowCheers(int countToDestroy)
        {
            if (lastCheersTime > 0)
            {
                return;
            }
            
            lastCheersTime = cheersCooldown;
            
            //iterate in random order through all cheers
            foreach (var cheer in GameManager.instance.GameplaySettings.popupTextElements.OrderBy(x => Random.value))
            {
                if (cheer.MinValue <= countToDestroy && cheer.MaxValue >= countToDestroy)
                {
                    PoolObject.GetObject(cheer.popupTextPrefab.name);
                    break;
                }
            }
        }
    }
}
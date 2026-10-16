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
using BubbleShooterGameToolkit.Scripts.Data;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.CommonUI
{
    public class LifeRefillTimer : MonoBehaviour
    {
        // Time in seconds for the refill interval (15 minutes = 900 seconds)
        private float refillInterval = 900.0f;
        
        // Maximum number of lives a player can have
        private int maxLives = 5;
        
        // Current elapsed time in seconds
        private float elapsedTime;

        // The actual time when the game was last disabled.
        private DateTime lastDisabledTime;
        private Life _life;

        public delegate void UpdateTime(float time);
        public static event UpdateTime OnUpdateTime;
        public double ElapsedTime => elapsedTime;

        public void Init(int maxLife, int refillLifeTime, Life life)
        {
            _life = life;
            maxLives = maxLife;
            refillInterval = refillLifeTime;

            StartCoroutine(WaitForServerTime());
        }

        private IEnumerator WaitForServerTime()
        {
            // Wait until the server time is received
            yield return new WaitUntil(() => TimeManager.instance.dateReceived || TimeManager.instance.noConnection);

            // Retrieve saved elapsed time
            elapsedTime = PlayerPrefs.GetFloat("ElapsedTime", 0);

            // Add the time difference to the elapsed time
            elapsedTime += TimeManager.instance.GetTimeSinceLastDisable();

            // Refill lives if needed
            RefillLivesIfNeeded();
        }

        private void OnDisable()
        {
            

            // Save the elapsed time
            PlayerPrefs.SetFloat("ElapsedTime", elapsedTime);
            PlayerPrefs.Save();
        }

        private void Update()
        {
            // Only tick if we aren't at the maximum number of lives
            if (_life != null && _life.GetResource() < maxLives)
            {
                // Increment the elapsed time
                elapsedTime += Time.deltaTime;


                // Refill lives if needed
                RefillLivesIfNeeded();
            }
            OnUpdateTime?.Invoke(refillInterval - elapsedTime % refillInterval);
        }

        private void RefillLivesIfNeeded()
        {
            int livesToRefill = Mathf.FloorToInt(elapsedTime / refillInterval);

            if (livesToRefill > 0 && _life.GetResource() < maxLives)
            {
                RefillLives(Mathf.Clamp(livesToRefill, 0, maxLives - _life.GetResource()));
                elapsedTime = 0;
            }
        }

        private void RefillLives(int amount)
        {
            _life.Add(amount);
        }
    }
}






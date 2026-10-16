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

using System.Collections.Generic;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;
using Random = UnityEngine.Random;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.FieldObjects
{
    public class BouncingManager : SingletonBehaviour<BouncingManager> 
    {
        readonly List<Bouncing> bouncings = new();
        public void AddBouncing()
        {
            var maxCount = GameManager.instance.GameplaySettings.bouncingCount;
            if (bouncings.Count >= maxCount) return;
            var bouncing = PoolObject.GetObject("Bouncing").GetComponent<Bouncing>();
            bouncings.Add(bouncing);
            float startingX = Random.Range(0, 2) == 0 ? -10f : 10f;
            float startingY = Random.Range(-6f, -3f);
            bouncing.transform.SetParent(GameCamera.instance.transform);
            bouncing.transform.localPosition = new Vector3(startingX, startingY, 0);
            bouncing.Begin();
        }
        
        public void RemoveBouncing()
        {
            if (bouncings.Count > 0)
            {
                var index = UnityEngine.Random.Range(0, bouncings.Count);
                var bouncing = bouncings[index];
                bouncings.RemoveAt(index);
                bouncing.Remove();
            }
        }
    }
}
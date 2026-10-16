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
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Pool
{
    class BabyTargetPool : PoolObject
    {
        public override void Awake()
        {
            base.Awake();
            InvokeRepeating("OrderBaby", 0.5f, 0.5f);
        }

        /// <summary>
        /// Order baby in transform hierarchy by Y position
        /// </summary>
        private void OrderBaby()
        {
            if (transform.childCount == 0)
                return;
            var children = new List<Transform>();
            foreach (Transform child in transform)
            {
                children.Add(child);
            }

            children.Sort((t1, t2) => t2.position.y.CompareTo(t1.position.y));
            for (int i = 0; i < children.Count; i++)
            {
                children[i].SetSiblingIndex(i);
            }
        }
    }
}
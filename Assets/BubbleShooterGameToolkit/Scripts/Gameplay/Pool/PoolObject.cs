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
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.Targets;
using UnityEngine;
using UnityEngine.Assertions;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Pool
{
    public class PoolObject : MonoBehaviour
    {
        // Static dictionary mapping prefab names to pools
        protected static readonly Dictionary<string, PoolObject> pools = new();

        public GameObject prefab;

        protected Queue<GameObject> pool = new();

        public virtual void Awake()
        {
            if (prefab != null) 
            {
                SetPrefab(prefab);
            }
        }

        public void SetPrefab(GameObject newPrefab)
        {
            // Add this pool to the static dictionary using its prefab name as the key
            // try to add to dictionary
            pools[newPrefab.name]= this;
            prefab = newPrefab;
        }

        private void OnDestroy()
        {
            pools.Clear();
        }

        protected GameObject Create() 
        {
            var item = Instantiate(prefab, transform);
            item.name = prefab.name; // remove (clone) from name
            var targetable = item.GetComponent<Targetable>();
            if (targetable)
            {
                targetable.parent = transform;
            }
            // item.SetActive(false);
            return item;
        }
    
        private GameObject Get()
        {
            var item = pool.Count == 0 ? Create() : pool.Dequeue();
            if (item.activeSelf && pool.Count > 0)
            {
                item = pool.Dequeue();
            }
            Assert.IsFalse(LevelManager.instance.destroyManager != null && LevelManager.instance.destroyManager.ballsToDestroy.Contains(item.GetComponent<Ball>()), "BallCharged in ballsToDestroy");

            item.SetActive(true);
            return item;
        }

        public static void Return(GameObject item)
        {
            if (item == null) return;

            item.SetActive(false);
            if (pools.TryGetValue(item.name, out PoolObject pool))
            {
                pool.pool.Enqueue(item);
            }
        }
        
        public static GameObject GetObject(GameObject prefab)
        {
            return GetPool(prefab);
        }

        private static GameObject GetPool(GameObject prefab)
        {
            string prefabName = prefab.name;
            if (pools.TryGetValue(prefabName, out PoolObject pool))
            {
                return pool.Get();
            }

            // Create a new pool if one doesn't exist
            var poolObject = new GameObject(prefabName).AddComponent<PoolObject>();
            poolObject.transform.SetParent(GameObject.Find("Pools").transform);
            poolObject.prefab = prefab;
            pools.Add(prefabName, poolObject);
            return poolObject.Get();
        }

        public static GameObject GetObject(string prefabName)
        {
            if (pools.TryGetValue(prefabName, out PoolObject pool))
            {
                return pool.Get();
            }

            Debug.LogError($"Pool with name {prefabName} not found");
            return null;
        }
    }
}
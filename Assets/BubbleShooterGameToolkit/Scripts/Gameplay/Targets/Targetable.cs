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

using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Properties;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Targets
{
    public abstract class Targetable: MonoBehaviour
    {
        private int targetIndex; // index of target for this ball

        [SerializeField]
        public AudioProperties audioProperties;

        [Header("Will be taken from pool")]
        [SerializeField]
        public GameObject fxPrefab;

        [HideInInspector] public Transform parent; // saved parent for returning after launch, made to move ball with camera

        public int GetTargetIndex()
        {
            if (targetIndex == 0)
                targetIndex = name.GetHashCode();
            return targetIndex;
        }

        public virtual void OnEnable()
        {
        }

        public void RestoreParent()
        {
            transform.SetParent(parent);
        }
    }
}
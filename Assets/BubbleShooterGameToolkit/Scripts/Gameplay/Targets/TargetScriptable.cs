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
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Targets
{
    [CreateAssetMenu(fileName = "target", menuName = "BubbleShooterGameToolkit/Add target", order = 1)]
    public class TargetScriptable : ScriptableObject
    {
        public bool countFromField;
        public string textForMenu;
        public GameObject prefab;
        public GameObject prefabAnimation;
        public Sprite uiIcon;
        public int defaultCount = 10;

        public virtual bool IsDone(int count)
        {
            return count <= 0;
        }
    }

    [Serializable]
    public class Target
    {
        public TargetScriptable target;
        public int count;
    }
 
}
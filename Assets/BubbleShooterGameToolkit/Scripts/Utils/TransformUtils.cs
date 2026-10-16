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

namespace BubbleShooterGameToolkit.Scripts.Utils
{
    public static class TransformUtils
    {
        public static void SetParentPosition(this Transform mainTR, Vector3 v)
        {
            List<Transform> list = new List<Transform>();
            var parent = mainTR.parent;
            for (int i = parent.childCount - 1; i >= 0; --i)
            {
                Transform child = parent.GetChild(i);
                child.SetParent(parent.parent);
                list.Add(child);
            }
            parent.transform.position = v;
            
            foreach (Transform child in list)
            {
                child.SetParent(parent, true);
            }
        }
        
    }

    public static class TryAddComponent
    {
        public static T AddComponentIfNotExists<T>(this GameObject gameObject) where T : Component
        {
            if (!gameObject.TryGetComponent<T>(out var component))
            {
                component = gameObject.AddComponent<T>();
            }

            return component;
        }
    }
}
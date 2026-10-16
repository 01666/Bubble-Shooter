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

using BubbleShooterGameToolkit.Scripts.CommonUI;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Editor
{
    [InitializeOnLoad]
    public class GameObjectRenameWatcher
    {
        static GameObjectRenameWatcher()
        {
            EditorApplication.hierarchyChanged += OnHierarchyChanged;

            // Subscribe to prefab save event
            PrefabStage.prefabSaving += OnPrefabSaving;
        }

        static void OnHierarchyChanged()
        {
            CustomTextMeshProUGUI[] tmpObjects = Object.FindObjectsOfType<CustomTextMeshProUGUI>();

            foreach (var tmp in tmpObjects)
            {
                if (tmp)
                {
                    tmp.text = tmp.gameObject.name;
                }
            }
        }

        static void OnPrefabSaving(GameObject prefab)
        {
            CustomTextMeshProUGUI[] tmpObjects = prefab.GetComponentsInChildren<CustomTextMeshProUGUI>(true);

            foreach (var tmp in tmpObjects)
            {
                if (tmp && tmp.text != tmp.gameObject.name)
                {
                    tmp.text = tmp.gameObject.name;
                    var rectTransform = tmp.GetComponent<RectTransform>();
                    if (rectTransform && tmp.preferredWidth > 0 && tmp.preferredHeight > 0 && rectTransform.sizeDelta == Vector2.zero)
                    {
                        rectTransform.sizeDelta = new Vector2(tmp.preferredWidth, tmp.preferredHeight);
                        // Make rectTransform stretched by its parent
                        rectTransform.anchorMin = new Vector2(0, 0);
                        rectTransform.anchorMax = new Vector2(1, 1);
                        rectTransform.offsetMin = new Vector2(0, 0);
                        rectTransform.offsetMax = new Vector2(0, 0);
                    }
                }
            }
        }
    }
}

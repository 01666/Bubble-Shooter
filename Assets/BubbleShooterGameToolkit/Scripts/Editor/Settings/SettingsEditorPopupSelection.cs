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
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UIElements;

namespace BubbleShooterGameToolkit.Scripts.Settings.Editor
{
    [CustomEditor(typeof(SettingsBase), true)]
    public class SettingsEditorPopupSelection : UnityEditor.Editor
    {
        public override VisualElement CreateInspectorGUI()
        {
            var attributePath = (EditPrefab)Attribute.GetCustomAttribute(target.GetType(), typeof(EditPrefab));

            if (attributePath != null)
            {
                var root = new VisualElement();

                var popupPath = attributePath.PopupPath;

                var button = new Button(() =>
                {
                    var asset = AssetDatabase.LoadMainAssetAtPath(popupPath);
                    if (asset != null)
                    {
                        PrefabStageUtility.OpenPrefab(AssetDatabase.GetAssetPath(asset));
                    }
                    else
                    {
                        Debug.LogError($"No asset found at path '{popupPath}'");
                    }
                })
                {
                    text = "Edit popup"
                };

                root.Add(new IMGUIContainer(() => { DrawDefaultInspector(); }));
                root.Add(button);

                return root;
            }

            // Draw default inspector if no ShowInCustomInspectorAttribute is found.
            return new IMGUIContainer(() => { DrawDefaultInspector(); });
        }
    }
    
    [AttributeUsage(AttributeTargets.Class)]
    public class EditPrefab : Attribute
    {
        public string PopupPath { get; }

        public EditPrefab(string popupPath)
        {
            PopupPath = popupPath;
        }
    }
    
    [AttributeUsage(AttributeTargets.Field, AllowMultiple = true)]
    public class HelpBoxAttribute : PropertyAttribute
    {
        public string HelpText;
        public HelpBoxMessageType messageType;

        public HelpBoxAttribute(string helpText, HelpBoxMessageType messageType = HelpBoxMessageType.None)
        {
            this.HelpText = helpText;
            this.messageType = messageType;
        }
    }
}
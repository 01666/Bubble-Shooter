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
using System.Linq;
using BubbleShooterGameToolkit.Scripts.Gameplay.Targets;
using BubbleShooterGameToolkit.Scripts.Utils;
using UnityEditor;
using UnityEditor.UIElements;
using UnityEngine;
using UnityEngine.UIElements;

namespace BubbleShooterGameToolkit.Scripts.Editor.LevelSystem.Drawers
{
    [CustomPropertyDrawer(typeof(Gameplay.Targets.Target))]
    [CanEditMultipleObjects]
    public class TargetListEditorDrawer : PropertyDrawer
    {
        private List<string> targetNames;

        public override VisualElement CreatePropertyGUI(SerializedProperty property)
        {
            if (EditorApplication.isPlaying)
                return null;

            var list = Resources.LoadAll<TargetScriptable>("Targets");
            targetNames = list.Select(i => i.name).ToList();
            var targetScriptable = GetTargetScriptable(property);
            var targetIndex = targetNames.IndexOf(targetScriptable?.name);
            if (targetIndex == -1 && targetNames.Any())
            {
                targetIndex = 0; // Select the first TargetScriptable in the dropdown
                property.FindPropertyRelative("target").objectReferenceValue = list.FirstOrDefault();
                property.serializedObject.ApplyModifiedProperties();
                targetScriptable = GetTargetScriptable(property);
            }
            
            var container = new VisualElement {style = {flexDirection = FlexDirection.Row}};
            var popupField = new PopupField<string>(targetNames, targetIndex);
            popupField.style.flexGrow = 1;
            var prefabContainer = GetPrefabContainer(targetScriptable);
            container.Add(prefabContainer);
            container.Add(popupField);
            
            var countsField = new PropertyField(property.FindPropertyRelative("count"));
            countsField.label = "";
            countsField.style.width = 100;
            countsField.bindingPath = "count";
            container.Add(countsField);
            countsField.visible = targetScriptable != null && !targetScriptable.countFromField;

            popupField.RegisterValueChangedCallback(evt =>
            {
                var selectedTarget = list.FirstOrDefault(i => i.name == evt.newValue);
                property.FindPropertyRelative("target").objectReferenceValue = selectedTarget;
                property.serializedObject.ApplyModifiedProperties();

                EditorUtility.SetDirty(property.serializedObject.targetObject);
                
                // Update prefab container
                container.Remove(prefabContainer);
                prefabContainer = GetPrefabContainer(selectedTarget);
                container.Insert(0, prefabContainer); // Considering it should be the first element in the container

                if (selectedTarget != null && !selectedTarget.countFromField)
                {
                    countsField.visible = true;
                    property.FindPropertyRelative("count").intValue = selectedTarget.defaultCount;
                    property.serializedObject.ApplyModifiedProperties();
                }

            });
            container.Bind(property.serializedObject);
            return container;
        }

        private static TargetScriptable GetTargetScriptable(SerializedProperty property)
        {
            var targetProperty = property.FindPropertyRelative("target");
            return targetProperty?.objectReferenceValue as TargetScriptable;
        }
        
        private VisualElement GetPrefabContainer(TargetScriptable target)
        {
            if (target.uiIcon != null)
            {
                return new VisualElement
                {
                    style =
                    {
                        width = 20,
                        height = 20,
                        backgroundImage = target.uiIcon.texture
                    }
                };
            }
            return target.prefab.gameObject.GetElementFromPrefab(20);
        }
    }
}
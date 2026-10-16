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
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.Targets;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;

namespace BubbleShooterGameToolkit.Scripts.Editor.LevelSystem
{
    [CustomEditor(typeof(Level))]
    [CanEditMultipleObjects]
    public class LevelEditor : UnityEditor.Editor
    {
        private Level level;

        public int num;
        private Vector2 scrollViewVector;
        private SerializedObject levelSerializedObject;
        private Tab1VisualElement tab1VisualElement;
        public Tab2VisualElement tab2VisualElement;
        private TargetScriptable[] targetScriptables;
        private bool _isFirstLoad;

        public override VisualElement CreateInspectorGUI()
        {
            _isFirstLoad = true;
            level = (Level) target;
            levelSerializedObject = new SerializedObject(level);

            num = level.Number;

            var root = new VisualElement{
                style = {flexGrow = 1}
            };
            
            var toolbarButton1 = new Foldout() { text = "General" };
            toolbarButton1.value = PlayerPrefs.GetInt("generalFold", 0) == 1;
            toolbarButton1.RegisterCallback<ChangeEvent<bool>>((evt) =>
            {
                if (_isFirstLoad) return;
                int num = evt.newValue ? 1 : 0; // Convert bool to int (1 or 0)
                PlayerPrefs.SetInt("generalFold", num);
                PlayerPrefs.Save();
            });
            var toolbarButton2 = new Foldout() { text = "Editor" };
            
            targetScriptables = Resources.LoadAll<TargetScriptable>("Targets");
            tab1VisualElement = new Tab1VisualElement(levelSerializedObject, level, this);
            tab1VisualElement.RegisterCallback<ChangeEvent<string>>((evt) =>
            {
                if(_isFirstLoad) return;
                EditorApplication.delayCall = Save;
            });
            tab2VisualElement = new Tab2VisualElement(levelSerializedObject, level, EditorItemsLoader.GetItems());
            tab2VisualElement.RegisterCallback<ChangeEvent<string>>((evt) =>
            {
                if(_isFirstLoad) return; 
                EditorApplication.delayCall = Save;
            });
            tab2VisualElement.OnFieldChanged += Save;

            toolbarButton1.Add(tab1VisualElement);
            toolbarButton2.Add(tab2VisualElement);
            root.Add(new LevelSwitcher(levelSerializedObject, level, this));
            root.Add(new VisualElement() {style = {height = 10}});
            root.Add(toolbarButton1);
            root.Add(toolbarButton2);

            root.RegisterCallback<FocusOutEvent>((evt) =>
            {
                if(_isFirstLoad) return;
                Save();
            });
            
            EditorApplication.delayCall = () =>
            {
                _isFirstLoad = false;
            };
            
            return root;
        }

        

        public void LoadLevel(int n)
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Levels/Level_" + (n) + ".asset");
            if(!Application.isPlaying)
            {
                // PlayerPrefs.SetInt("OpenLevel", n);
                PlayerPrefs.Save();
            }
        }

        
        public void Save()
        {
            TryAssignTarget();
            SaveChanges();
            EditorUtility.SetDirty(level);
        }
        
        private void TryAssignTarget()
        {
            // Remove targets
            level.targets?.RemoveAll(target => target.target.countFromField && !level.Blocks.Any(block => block.levelElement.Prefab == target.target.prefab || block.cover.Prefab == target.target.prefab ||
                                                                                                         block.hidden.Prefab == target.target.prefab || block.label.Prefab == target.target.prefab ||
                                                                                                         block.holding.Prefab == target.target.prefab));
            // Add targets
            foreach (var targetScriptable in targetScriptables)
            {
                for (var index = 0; index < level.Blocks.Count; index++)
                {
                    var block = level.Blocks[index];
                    if (block == null)
                        continue;

                    var isPrefabMatching =
                        block.levelElement.Prefab == targetScriptable.prefab
                        || block.cover.Prefab == targetScriptable.prefab
                        || block.hidden.Prefab == targetScriptable.prefab
                        || block.label.Prefab == targetScriptable.prefab;

                    var isComponentMatching = false;
                    if (!block.levelElement.IsEmpty)
                    {
                        var ballComponent = block.levelElement.Prefab.GetComponent<Ball>();
                        isComponentMatching =
                            ballComponent.hidden?.name == targetScriptable.prefab.name
                            || ballComponent.cover?.name == targetScriptable.prefab.name
                            || ballComponent.label?.name == targetScriptable.prefab.name;
                    }

                    var isTargetScriptableInLevelTargets =
                        level.targets?.All(target => target.target != targetScriptable) ?? true;

                    if ((isPrefabMatching || isComponentMatching) && isTargetScriptableInLevelTargets && targetScriptable.countFromField)
                    {
                        level.targets ??= new List<Target>();
                        level.targets.Insert(0, new Target() { target = targetScriptable });
                        break;
                    }
                }
            }
        }

        public void Reload()
        {
            EditorApplication.delayCall = () =>
            {
                Selection.activeObject = null;
                EditorApplication.delayCall = () => { LoadLevel(num); };
            };
        }
        
        public void ReloadField()
        {
            tab2VisualElement.Reload();
        }
    }
}
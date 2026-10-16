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

using System.Linq;
using BubbleShooterGameToolkit.Scripts.CommonUI.Tutorials;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using UnityEditor;
using UnityEngine.UIElements;

namespace BubbleShooterGameToolkit.Scripts.Editor
{
    [CustomEditor(typeof(TutorialSetup))]
    public class TutorialSetupEditor : UnityEditor.Editor
    {
        public VisualTreeAsset visualTreeAsset;

        public override VisualElement CreateInspectorGUI()
        {
            //target
            var tutorialSetup = (TutorialSetup) target;
            var root = new VisualElement();
            visualTreeAsset.CloneTree(root);
            var ballsPrefab = EditorItemsLoader.GetItems();
            var ballValues = ballsPrefab.Select(i=>i.Prefab.GetComponent<Ball>()).Where(i=>i!=null && !i.name.Contains("_")).ToList();
            var ballLabels = ballValues.Select(b => b.name).ToList();
            var list = new PopupField<string>("Launch Ball", ballLabels, 0);
            list.value = ballLabels.Find(i=>i==tutorialSetup?.launchBall?.name)??"";

            list.RegisterValueChangedCallback(evt =>
            {
                if (evt.newValue != null)
                {
                    tutorialSetup.launchBall = ballValues[ballLabels.IndexOf(evt.newValue)];
                    
                    //save prefab
                    EditorUtility.SetDirty(tutorialSetup);
                    AssetDatabase.SaveAssets();
                    AssetDatabase.Refresh();
                }
            });
            root.Add(list);

            return root;
        }
    }
}
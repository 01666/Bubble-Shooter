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
using TMPro;
using UnityEditor;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Editor
{
    public static class CustomTextMeshProUGUICreator
    {
        [MenuItem("GameObject/UI/Custom TMP UGUI", false, 10)]
        public static void CreateCustomTextMeshProUGUI()
        {
            GameObject newObject = new GameObject("Default Name");
            CustomTextMeshProUGUI customText = newObject.AddComponent<CustomTextMeshProUGUI>();

            customText.fontSize = 32;
            customText.enableAutoSizing = true;
            customText.fontSizeMin = 16;
            customText.fontSizeMax = 200;
            customText.alignment = TextAlignmentOptions.Center;

            // Parent the new object to the currently selected object
            if (Selection.activeGameObject)
            {
                newObject.transform.SetParent(Selection.activeGameObject.transform, false);
            }
            else
            {
                // If no object is selected, but there's a canvas, parent it to the canvas
                Canvas parentCanvas = GameObject.FindObjectOfType<Canvas>();
                if (parentCanvas)
                {
                    newObject.transform.SetParent(parentCanvas.transform, false);
                }
            }

            // Ensure it's selected
            Selection.activeObject = newObject;
        }
    }
}
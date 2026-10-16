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

using UnityEditor;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Editor
{
    #if UNITY_EDITOR
    [CustomEditor(typeof(BezierGridLayout))]
    public class BezierCurveInspector : UnityEditor.Editor
    {
        private BezierGridLayout bezierGrid;
        private RectTransform rectTransform;

        private const int lineSteps = 100;

        private void OnSceneGUI()
        {
            bezierGrid = target as BezierGridLayout;
            rectTransform = bezierGrid.transform as RectTransform;

            for (int i = 0; i < bezierGrid.controlPoints.Count; i++)
            {
                ShowPoint(i);
            }

            if (bezierGrid.controlPoints.Count < 4) return; // Skip drawing if less than 4 points

            // Draw the curve
            Handles.color = Color.cyan;
            Vector3 lineStart = bezierGrid.GetPointOnBezierCurve(0);
            for (int i = 1; i <= lineSteps; i++)
            {
                Vector3 lineEnd = bezierGrid.GetPointOnBezierCurve(i / (float)lineSteps);
                Handles.DrawLine(rectTransform.TransformPoint(lineStart), rectTransform.TransformPoint(lineEnd));
                lineStart = lineEnd;
            }
        }

        private Vector3 ShowPoint(int index)
        {
            var point = bezierGrid.controlPoints[index];
            EditorGUI.BeginChangeCheck();
            point = Handles.PositionHandle(rectTransform.TransformPoint(point), Quaternion.identity);

            if (EditorGUI.EndChangeCheck())
            {
                Undo.RecordObject(bezierGrid, "Move Point");
                EditorUtility.SetDirty(bezierGrid);
                Vector2 localPoint;
                RectTransformUtility.ScreenPointToLocalPointInRectangle(rectTransform, point, null, out localPoint);
                bezierGrid.controlPoints[index] = localPoint;
                // Recalculate positions after point change
                bezierGrid.CalculatePositions();
            }
            return point;
        }
    }
    #endif
}
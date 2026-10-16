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

using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.Utils;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Targets
{
    public class TargetObjectController
    {
        private readonly TargetObjectModel model;
        private readonly TargetObjectUI view;

        public TargetObjectController(Target target, TargetObjectUI targetObjectUI, int count, int index, LevelManager levelManager)
        {
            model = new TargetObjectModel(target, count, index, levelManager);
            this.view = targetObjectUI;
            this.view.UpdateTarget(model.Count, model.IsDone(), MovesTimeManager.instance.GetMoves());
        }

        // So, animate the ball and update the target in the view when the animation ends.
        public bool OnCount(BallCollectEventArgs e)
        {
            // Check if the current ball is the target, return false if not
            if (!IsTarget(e.targetObject)) return false;

            var targetObject = e.targetObject;
            targetObject.transform.SetParent(targetObject.parent);
            targetObject.gameObject.SetActive(false);
            model.OnCount();
            view.UpdateTarget(model.Count, model.IsDone(), MovesTimeManager.instance.GetMoves());

            // target with specific animation by prefab
            var targetPrefab = model.target.prefabAnimation;
            if (targetPrefab != null)
            {
                var obj = PoolObject.GetObject(targetPrefab).GetComponent<AnimatedTargetBase>();
                obj.Init(targetObject.transform.position.SnapZ(), view.transform.position.SnapZ());
            }

            return true;  // return true as the ball is successfully counted
        }


        public bool IsTarget(Targetable ball)
        {
            return model.targetIndex == ball.GetTargetIndex() && model.Count > 0;
        }

        public bool IsDone() => model.IsDone();
        public TargetObjectModel GetModel() => model;
        public TargetObjectUI GetView() => view;
    }
}
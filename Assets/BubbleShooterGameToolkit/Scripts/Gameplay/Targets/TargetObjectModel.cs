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

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Targets
{
    public class TargetObjectModel
    {
        private int count;
        private readonly bool countFromField;
        public readonly int targetIndex;
        private LevelManager levelManager;
        public readonly TargetScriptable target;
        public int Count => count;

        public TargetObjectModel(Target targetBind, int _count, int index, LevelManager levelManager)
        {
            this.levelManager = levelManager;
            this.target = targetBind.target;
            this.countFromField = targetBind.target.countFromField;
            this.targetIndex = index;
            this.count = countFromField ? CountFromField() : _count;
        }

        private int CountFromField()
        {
            int totalCount = 0;

            // Assuming levelManager.balls is of type List<List<Ball>>
            foreach (var ballList in levelManager.balls)
            {
                foreach (var ball in ballList)
                {
                    if (ball != null)
                    {
                        if(ball.IsTarget(targetIndex))
                            totalCount++;
                        
                    }
                }
            }

            return totalCount;
        }
        
        public void OnCount()
        {
            count--;
            if (count < 0)
                count = 0;
        }

        public bool IsDone() => target.IsDone(count);
    }
}
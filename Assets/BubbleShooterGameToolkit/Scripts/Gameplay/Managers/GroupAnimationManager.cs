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
using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.System;
using BubbleShooterGameToolkit.Scripts.Utils;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    public class GroupAnimationManager : SingletonBehaviour<GroupAnimationManager>
    {
        private List<AnimationTask> activeTasks = new List<AnimationTask>();
        private AnimationPool animationPool;
        private Camera cam;

        private void Start()
        {
            animationPool = new AnimationPool(100);  // initial pool size
            cam = Camera.main;
        }
        
        public void Animate(Transform ballTransform, float time, Vector3 targetPosition,  Quaternion targetRotation, bool finishInstantly, Action callback = null)
        {
            AnimationTask task = animationPool.GetTask();
            task.ballTransform = ballTransform;
            task.StartPosition = ballTransform.localPosition;
            task.StartRotation = ballTransform.rotation;
            task.TargetPosition = targetPosition.SnapZ();
            task.TargetRotation = targetRotation;
            task.Time = time;
            task.finished = finishInstantly;
            task.Callback = callback;
            task.ElapsedTime = 0;

            activeTasks.Add(task);
        }

        private void Update()
        {
            for (int i = activeTasks.Count - 1; i >= 0; i--)
            {
                AnimationTask task = activeTasks[i];
                task.ElapsedTime += Time.deltaTime;

                float progress = task.ElapsedTime / task.Time;
                task.ballTransform.transform.localPosition = Vector3.Lerp(task.StartPosition, task.TargetPosition, progress);
                task.ballTransform.transform.rotation = Quaternion.Lerp(task.StartRotation, task.TargetRotation, progress);

                if (task.ElapsedTime >= task.Time)
                {
                    task.Callback?.Invoke();
                    activeTasks[i].finished = true;
                    activeTasks.RemoveAt(i);
                    animationPool.ReturnTask(task);  // return task to the pool
                }
            }
        }

        public bool AnyAnimation()
        {
            return activeTasks.Count > 0 && activeTasks.Any(i => !i.finished);
        }
    }
    
    public class AnimationPool
    {
        private readonly Stack<AnimationTask> availableTasks;

        public AnimationPool(int initialSize)
        {
            availableTasks = new Stack<AnimationTask>(initialSize);

            for (int i = 0; i < initialSize; i++)
            {
                availableTasks.Push(new AnimationTask());
            }
        }

        public AnimationTask GetTask()
        {
            if (availableTasks.Count == 0)
            {
                availableTasks.Push(new AnimationTask());
            }

            return availableTasks.Pop();
        }

        public void ReturnTask(AnimationTask task)
        {
            availableTasks.Push(task);
        }
    }
    
    public class AnimationTask
    {
        public Transform ballTransform { get; set; }
        public Vector3 StartPosition { get; set; }
        public Quaternion StartRotation { get; set; }
        public Vector3 TargetPosition { get; set; }
        public float Time { get; set; }
        public Action Callback { get; set; }
        public float ElapsedTime { get; set; }
        public Quaternion TargetRotation { get; set; }
        // task finished
        public bool finished;
    }
}
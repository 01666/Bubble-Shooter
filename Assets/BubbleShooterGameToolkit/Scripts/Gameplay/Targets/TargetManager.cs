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
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Targets
{
    public class TargetManager : SingletonBehaviour<TargetManager>
    {
        public List<TargetObjectController> _targetObjectControllers = new List<TargetObjectController>();

        void Start()
        {
            SetupEventListeners();
        }

        private void OnDisable()
        {
            RemoveEventListeners();
        }

        void SetupEventListeners()
        {
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.ItemDestroyed).Subscribe(OnCount);
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.Uncover).Subscribe(OnCount);
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.Fall).Subscribe(OnCount);
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.StarActivated).Subscribe(OnCount);
        }

        void RemoveEventListeners()
        {
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.ItemDestroyed).Unsubscribe(OnCount);
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.Uncover).Unsubscribe(OnCount);
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.Fall).Unsubscribe(OnCount);
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.StarActivated).Unsubscribe(OnCount);
        }
        
        private void OnCount(BallCollectEventArgs collectEventArgs)
        {
            foreach (var targetObject in _targetObjectControllers)
            {
                targetObject.OnCount(collectEventArgs);
            }
        }

        public bool IsTarget(Targetable ball)
        {
            bool isTarget = false;
            foreach (var targetObject in _targetObjectControllers)
            {
                if (targetObject.IsTarget(ball))
                {
                    isTarget = true;
                    break;
                }
            }
            return isTarget;
        }

        public bool IsTargetsDone()
        {
            // Check if all targets are done
            foreach (var targetObject in _targetObjectControllers)
            {
                if (!targetObject.IsDone())
                    return false;
                if (targetObject.GetModel().target.name == "Stars")
                {
                    if (_targetObjectControllers.Count == 1 && targetObject.IsDone() && MovesTimeManager.instance.GetMoves() > 0 && LevelManager.instance.LevelGridManager.AnyBallExists())
                        return false;
                }
            }
            return true;
        }

        public int GetTargetCount(string targetName)
        {
            int count = 0;
            foreach (var targetObject in _targetObjectControllers)
            {
                if (targetObject.GetModel().target.name == targetName)
                {
                    count = targetObject.GetModel().Count;
                    break;
                }
            }
            return count;
        }
    }
}
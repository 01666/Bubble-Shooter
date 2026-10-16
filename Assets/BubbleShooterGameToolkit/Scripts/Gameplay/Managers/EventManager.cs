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
using BubbleShooterGameToolkit.Scripts.CommonUI;
using BubbleShooterGameToolkit.Scripts.CommonUI.Popups;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
     public enum EGameEvent
    {
        LevelLoaded,
        Win,
        Map,
        Play,
        BallStopped,
        ItemDestroyed,
        Uncover,
        Fall,
        ToDestroy,
        BallLaunched,
        BoostActivated,
        BoostDeactivated,
        BallsDestroyed,
        StarActivated,
        CheckSeparatedBalls,
        ColorRemoved
    }

    public class EventManager
    {
        // A dictionary to hold all events
        private static readonly Dictionary<EGameEvent, object> events = new();

        public static Event<T> GetEvent<T>(EGameEvent eventName)
        {
            if (events.TryGetValue(eventName, out var e) && e is Event<T> typedEvent)
            {
                return typedEvent;
            }
            else
            {
                var newEvent = new Event<T>();
                events[eventName] = newEvent;
                return newEvent;
            }
        }

        // no generic event
        public static Event GetEvent(EGameEvent eventName)
        {
            if (events.TryGetValue(eventName, out var e) && e is Event typedEvent)
            {
                return typedEvent;
            }
            else
            {
                var newEvent = new Event();
                events[eventName] = newEvent;
                return newEvent;
            }
        }

        private static EStatus gameStatus;
        public static EStatus GameStatus => gameStatus;

        public static void SetGameStatus(EStatus newStatus)
        {
            if(gameStatus == newStatus) return;
            gameStatus = newStatus;
            switch (newStatus)
            {
                case EStatus.Play:
                    GetEvent<EStatus>(EGameEvent.Play).Invoke(newStatus);
                    break;
                case EStatus.Win:
                    GameManager.instance.life.Add(1);
                    GetEvent<EStatus>(EGameEvent.Win).Invoke(newStatus);
                    break;
                case EStatus.Pause:
                    MenuManager.instance.ShowPopup<MenuPause>();
                    break;
                case EStatus.Fail:
                    if(LevelLoader.instance.CurrentLevel.levelMode == ELevelMode.Moves)
                        MenuManager.instance.ShowPopup<PreFail>(null, ResultActionOnFail);
                    else
                        MenuManager.instance.ShowPopup<PreFailTime>(null, ResultActionOnFail);

                    break;
                case EStatus.Map:
                    Debug.Log("Map");
                    GetEvent(EGameEvent.Map).Invoke();
                    break;
            }
        }

        private static void ResultActionOnFail(EPopupResult result)
        {
            if (result == EPopupResult.Cancel)
            {
                MenuManager.instance.ShowPopup<MenuFail>();
            }
            else if (result == EPopupResult.Continue)
            {
                MovesTimeManager.instance.AddMoves(LevelLoader.instance.CurrentLevel.levelMode == ELevelMode.Moves ? GameManager.instance.GameSettings.movesContinue : GameManager.instance.GameSettings.timeContinue);
                SetGameStatus(EStatus.Play);
            }
        }
    }
    public class Event<T>
    {
        private event Action<T> _event;

        public void Subscribe(Action<T> subscriber)
        {
            _event += subscriber;
        }

        public void Unsubscribe(Action<T> subscriber)
        {
            _event -= subscriber;
        }

        public void Invoke(T arg)
        {
            _event?.Invoke(arg);
        }
    }

    public class Event
    {
        private event Action _event;

        public void Subscribe(Action subscriber)
        {
            _event += subscriber;
        }

        public void UnSubscribe(Action subscriber)
        {
            _event -= subscriber;
        }

        public void Invoke()
        {
            _event?.Invoke();
        }
    }

}
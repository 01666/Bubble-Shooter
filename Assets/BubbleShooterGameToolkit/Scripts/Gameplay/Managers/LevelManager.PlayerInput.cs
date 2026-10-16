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

using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers;
using BubbleShooterGameToolkit.Scripts.Gameplay.GUI;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;
using UnityEngine.EventSystems;
using Object = UnityEngine.Object;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    /// Input manager detects user input, launches the ball and debug stuff
    public partial class LevelManager
    {
        [SerializeField] public LaunchContainer launchContainer;
        [SerializeField] public BallContainerSpawn ballContainerSpawn;
        [SerializeField] private RectTransform switchRect;
        [SerializeField] private AimLine aimLine;
        private Camera uiCamera;
        private RaycastManager raycastManager;
        private RaycastData raycastData;
        private int num;
        private bool isTouchStarted;

        public override void Awake()
        {
            base.Awake();
            Canvas canvas = switchRect.GetComponentInParent<Canvas>();
            if (canvas != null)
            {
                uiCamera = canvas.worldCamera;
            }
            raycastManager = new RaycastManager();
        }
        private void Switch()
        {
            ballContainerSpawn.SwitchBalls();
        }

        private void Update()
        {
            if ((EventManager.GameStatus == EStatus.Play || EventManager.GameStatus == EStatus.Tutorial) && MovesTimeManager.instance.GetMoves() > 0)
            {
                if (IsTouchStarted(true))
                {
                    if (launchContainer.BallCharged != null)
                    {
                        raycastData = GetRaycastData(launchContainer.BallCharged.gameObject, launchContainer.transform.position, GameCamera.instance.GetControlBounds(GameCamera.instance.Camera.ScreenToWorldPoint(Input.mousePosition)));
                        DrawAimLine(raycastData, launchContainer.BallCharged);
                    }
                }

                if (IsTouchStarted(false))
                {
                    if (RectTransformUtility.RectangleContainsScreenPoint(switchRect, Input.mousePosition, uiCamera))
                    {
                        Switch();
                        SoundBase.instance.PlaySound(SoundBase.instance.swish[1]);
                    }
                    else if (launchContainer.BallCharged != null)
                    {
                        raycastData = GetRaycastData(launchContainer.BallCharged.gameObject, launchContainer.transform.position, GameCamera.instance.GetControlBounds(GameCamera.instance.Camera.ScreenToWorldPoint(Input.mousePosition)));
                        if (raycastData != null)
                        {
                            launchContainer.LaunchBall(raycastData);
                        }
                    }
                }
                else
                {
                    HidePoints();
                }
            }

            if(debugSettings.enableShortcuts)
            {
                if (EventManager.GameStatus == EStatus.Play)
                {
                    if (Input.GetKeyDown(debugSettings.Win))
                    {
                        EventManager.SetGameStatus(EStatus.Win);
                    }
                    if (Input.GetKeyDown(debugSettings.Lose))
                    {
                        MovesTimeManager.instance.SetMoves(0);
                        EventManager.SetGameStatus(EStatus.Fail);
                    }
                    if (Input.GetKeyDown(debugSettings.OneMove))
                    {
                        MovesTimeManager.instance.SetMoveToOne();
                    }
                    if (Input.GetKeyDown(debugSettings.fillPowerUp))
                    {
                        var powerCollector = FindObjectOfType<PowerCollector>();
                        powerCollector.power = 1;
                        powerCollector.UpdateEnergyBar();
                        powerCollector.ReleasePower();
                    }
                }
                if (Input.GetKeyDown(debugSettings.Restart))
                {
                    SceneLoader.instance.StartGameScene();
                }
            }
        }

        private bool IsTouchStarted(bool down)
        {
            #if UNITY_EDITOR || UNITY_STANDALONE || UNITY_WEBGL
            if (down)
            {
                return Input.GetMouseButton(0) && !EventSystem.current.IsPointerOverGameObject();
            }

            return Input.GetMouseButtonUp(0) && !EventSystem.current.IsPointerOverGameObject();
            #else
            if (Input.touchCount > 0 && !EventSystem.current.IsPointerOverGameObject(Input.GetTouch(0).fingerId))
            {
                if (down)
                {
                    if(IsPhaseMoving())
                        isTouchStarted = true;
                    return isTouchStarted;
                }
                if (isTouchStarted)
                {
                    if(IsPhaseTouching())
                        isTouchStarted = false;
                        
                    return IsPhaseTouching();
                }
            }
            return false;
            #endif
        }

        private static bool IsPhaseTouching()
        {
            return Input.GetTouch(0).phase == TouchPhase.Ended;
        }

        private static bool IsPhaseMoving()
        {
            return Input.GetTouch(0).phase == TouchPhase.Moved || Input.GetTouch(0).phase == TouchPhase.Stationary || Input.GetTouch(0).phase == TouchPhase.Began;
        }

        public RaycastData GetRaycastData(GameObject ignoreObject, Vector3 position, Vector3 nextPoint)
        {
            Vector3 direction = (nextPoint - position).normalized;
            var raycastFromBall = RaycastFromBall(position, direction, ignoreObject);
            raycastFromBall.screenMousePosition =  GameCamera.instance.Camera.WorldToScreenPoint(nextPoint);
            raycastFromBall.worldMousePosition = nextPoint;
            return raycastFromBall;
        }

        public RaycastData UpdateRaycastData(GameObject ignoreObject, RaycastData data)
        {
            return GetRaycastData(ignoreObject, data.hits[0].point, data.worldMousePosition);
        }

        public RaycastData RaycastFromBall(Vector3 position, Vector3 direction, GameObject ignoreObject)
        {
            var raycastFromBall = raycastManager.RaycastHit2D(position, ignoreObject, direction);
            return raycastFromBall;
        }

        public void DrawAimLine(RaycastData raycastData, Ball ballCharged)
        {
            aimLine.DrawAimLine(ballCharged.GetColorForAim(), raycastData.hits, raycastData.positionNearBall);
        }

        private void HidePoints()
        {
            aimLine.HidePoints();
        }
    }
}
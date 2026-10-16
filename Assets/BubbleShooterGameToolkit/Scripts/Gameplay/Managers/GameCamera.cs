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

#region

using System;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.FieldObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

#endregion

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    public class GameCamera : SingletonBehaviour<GameCamera>
    {
        public float y_target;
        public float y_topBall;

        [SerializeField]
        public Transform topPivotUI;
        
        [SerializeField]
        private Transform topBorder;

        [SerializeField]
        private Transform leftBorder;
        
        [SerializeField]
        private Transform rightBorder;

        [SerializeField, Header("Lower point to scroll camera")]
        private Transform cameraPivot;

        private Vector3 _safePos;
        private Ball centerBall;
        private Vector3 centerPosition;
        private bool starting;
        private Action onstart;
        private Ball topBall;

        private Camera _camera;
        [SerializeField, Header("Speed before start")]
        private float speed = 10.0f;
        [SerializeField, Header("Speed on game")]
        private float speedGame = 3.0f;

        private readonly float offsetY = 1.8f;
        [HideInInspector]
        public bool testMode;

        [HideInInspector]
        public Ball bottomBall;

        public Camera Camera
        {
            get
            { 
                if (_camera == null)
                {
                    _camera = GetComponent<Camera>();
                }
                return _camera;
            }
            set => _camera = value;
        }

        private void Start()
        {
            EventManager.GetEvent<EStatus>(EGameEvent.Play).Subscribe(OnLevelLoaded);
        }

        private void OnLevelLoaded(EStatus eStatus)
        {
            speed = speedGame;
            EventManager.GetEvent<EStatus>(EGameEvent.Play).Unsubscribe(OnLevelLoaded);
        }

        public void SetVerticalLevel()
        {
            Camera.orthographicSize = GameManager.instance.GameplaySettings.cameraSize / Screen.width * Screen.height / 2f;
        }

        public void SetRoratingLevel(Ball _rotatingLevelBall, Vector3 _center, int levelSizeX, int levelSizeY)
        {
            centerBall = _rotatingLevelBall;
            centerPosition = _center;
            leftBorder.gameObject.AddComponent<Wall>();
            rightBorder.gameObject.AddComponent<Wall>();
            topBorder.gameObject.AddComponent<Wall>();
            AdjustCameraSize(levelSizeX, levelSizeY);
        }

        private void AdjustCameraSize(float levelWidth, float levelHeight)
        {
            float sizeRatio = Math.Max(levelWidth, levelHeight) / 8f;
            float aspectRatioManagement = Mathf.Pow(Camera.aspect, 0.5f);
            Camera.orthographicSize = sizeRatio * aspectRatioManagement * (GameManager.instance.GameplaySettings.cameraSize / Screen.width * Screen.height / 2f);
        }

        public void MoveToStartingPosition(Action onStart)
        {
            starting = true;
            onstart = onStart;
        }

       private void Update()
       {
           if (LevelManager.instance == null || LevelLoader.instance.CurrentLevel == null)
               return;
           
           if(testMode)
           {
               onstart?.Invoke();
               return;
           }

           _safePos = transform.position;
           Vector3 dest = Vector3.zero;

           if (LevelLoader.instance.CurrentLevel.levelType != ELevelTypes.Rotating)
           {
               dest = new Vector3(transform.position.x, y_target, -10);
               if (topPivotUI.position.y <= y_topBall + offsetY || dest.y < transform.position.y)
               {
                   transform.position = Vector3.MoveTowards(transform.position, dest, speed * Time.deltaTime);
               }
           }
           else
           {
               if (centerBall != null && centerBall.Flags.HasFlag(EBallFlags.Pinned))
               {
                   y_target = centerPosition.y;
                   float rotationOffset = Camera.aspect;
                   dest = new Vector3(transform.position.x, y_target - rotationOffset, -10);
                   transform.position = Vector3.MoveTowards(transform.position, dest, speed * Time.deltaTime);
               }
           }

           if (starting && (Vector2.Distance(transform.position, dest) < 0.1f || transform.position == _safePos))
           {
               starting = false;
               var pos = CalculateScreenBounds();
               leftBorder.localPosition = new Vector3(pos.bottomLeft.x - 1f, 0, 0);
               rightBorder.localPosition = new Vector3(pos.topRight.x + 1f, 0, 0);
               if (LevelLoader.instance.CurrentLevel.levelType == ELevelTypes.Rotating)
               {
                   topBorder.position = new Vector3(0, topPivotUI.position.y, 0);
               }
               onstart?.Invoke();
           }
       }

        public void CheckLowestBall()
        {
            topBall = null;
            bottomBall = null;

            if (LevelManager.instance == null)
            {
                return;
            }

            foreach (var ballList in LevelManager.instance.balls)
            {
                foreach (var ball in ballList)
                {
                    if (ball != null && ball.Flags.HasFlag(EBallFlags.Pinned) && ball.gameObject.activeSelf)
                    {
                        if (topBall == null || ball.transform.position.y > topBall.transform.position.y)
                            topBall = ball;

                        if (bottomBall == null || ball.transform.position.y < bottomBall.transform.position.y)
                            bottomBall = ball;
                    }
                }
            }

            if (topBall != null)
            {
                y_topBall = topBall.transform.position.y;
            }

            if (bottomBall != null)
            {
                y_target = bottomBall.transform.position.y;
                y_target = y_target + (transform.position.y- cameraPivot.position.y);
            }
            
            speed = Mathf.Max(speed, Vector3.Distance(transform.position, new Vector3(transform.position.x, y_target - offsetY, -10)));
        }
        
        public (Vector3 topRight, Vector3 bottomLeft) CalculateScreenBounds()
        {
            float cameraHeight = 2f * Camera.orthographicSize;
            float cameraWidth = cameraHeight * Camera.aspect;

            float halfHeight = cameraHeight * 0.35f;
            float halfWidth = cameraWidth * 0.5f;

            Vector3 cameraPosition = Camera.transform.position;
            Vector3 topRight = cameraPosition + new Vector3(halfWidth-.5f, halfHeight, 0);
            Vector3 bottomLeft = cameraPosition + new Vector3(-halfWidth+.5f, -halfHeight, 0);

            return (topRight, bottomLeft);
        }

        public Vector3 GetControlBounds(Vector3 toWorldPoint)
        {
            var screenToWorldPoint = toWorldPoint;
            screenToWorldPoint -= Vector3.back * 10;
            //clamp y position not less than cannon position + 3
            var bottomBound = LevelManager.instance.launchContainer.transform.position.y + 3.0f;
            if (screenToWorldPoint.y < bottomBound)
            {
                screenToWorldPoint.y = bottomBound;
            }
                
            return screenToWorldPoint;
        }

        private Vector3 GetWorldSize(RectTransform rectTransform) 
        {
            Vector3[] corners = new Vector3[4];
            rectTransform.GetWorldCorners(corners);
            Vector3 worldSize = corners[2] - corners[0];
            return worldSize;
        }

        public bool IsMoving()
        {
            return transform.position != _safePos;
        }
    }
}
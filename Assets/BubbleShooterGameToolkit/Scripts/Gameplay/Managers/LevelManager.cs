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

using System.Collections;
using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.CommonUI;
using BubbleShooterGameToolkit.Scripts.CommonUI.Popups;
using BubbleShooterGameToolkit.Scripts.Data;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.Animations;
using BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers;
using BubbleShooterGameToolkit.Scripts.Gameplay.FieldObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.GUI;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.Gameplay.Targets;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using BubbleShooterGameToolkit.Scripts.Settings;
using BubbleShooterGameToolkit.Scripts.System;
using BubbleShooterGameToolkit.Scripts.Utils;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    /// Core gameplay type processing entire game loop from start to end
    public partial class LevelManager : SingletonBehaviour<LevelManager>
    {
        //keep all balls here
        public List<List<Ball>> balls = new();
        //balls spawn pivot
        public Transform field;
        //loaded level reference

        public Level Level => LevelLoader.instance.CurrentLevel;

        //max width of level in balls
        public int columnMax (int y)=> y % 2 == 1 ? Level.sizeX : Level.sizeX - 1;

        public int CurrentLevel => Level?.Number??1;
        
        private LevelGridManager levelGridManager;
        public LevelGridManager LevelGridManager
        {
            get => levelGridManager ??= new LevelGridManager(this);
            private set => levelGridManager = value;
        }

        //for rotating level purpose
        [HideInInspector] public Transform ball_center_pivot;

        //holes on the ground
        [SerializeField] private GameObject holes;
        //bottom border, enables if no holes on the bottom
        [SerializeField] private GameObject bottomBorder;
        //bottom border limits bottom balls for rotation level
        [SerializeField] private GameObject bottomBorderForRotation;
        //line represents top of the level
        [SerializeField] private GameObject bubbleLine;

        private int[] notConnectedBalls;
        
        public DestroyManager destroyManager;
        public MatchingManager matchingManager;
        private IEnumerator coroutineCheckMovesAndTargets;
        
        private DebugSettings debugSettings;
        private int comboCount;
        [SerializeField]
        public RectTransform landingRect;

        private bool searchSeparate;
        public RotatingLevelBall rotatingLevelBall;
        private Ball ballLaunched;
        private SeparatingBallManager separatingBallManager;
        private int matchCount;

        private void OnEnable()
        {
            destroyManager = new DestroyManager();
            matchingManager = new MatchingManager();
            debugSettings = Resources.Load<DebugSettings>("Settings/DebugSettings");
            separatingBallManager = GetComponent<SeparatingBallManager>();
            LevelGridManager = new LevelGridManager(this);
        }
    
        /// Init variables and load the level
        public void InitGame()
        {
            Ball.RootBalls.Clear();
            balls = new List<List<Ball>>(Level.sizeY);
            // load level
            LevelGridManager.GenerateLevel();
            // reset rigid bodies
            Physics2D.SyncTransforms();
            if (Level.levelType == ELevelTypes.Rotating)
            {
                var ball = LevelUtils.GetBall<Ball>(4, 4+4);
                rotatingLevelBall = ball.gameObject.GetComponent<RotatingLevelBall>();
                var centerPosition = rotatingLevelBall.transform.position.SnapZCamera() + Vector3.down * 1.5f;
                GameCamera.instance.SetRoratingLevel(ball, centerPosition, 10, 10);
                bottomBorderForRotation.SetActive(true);
            }
            else
            {
                GameCamera.instance.SetVerticalLevel();
                //generate line on the top of the level
                for (float x = -10f; x < 10f; x += 0.3f)
                {
                    Instantiate(bubbleLine, new Vector3(x, field.position.y + 0.8f, 0), Quaternion.identity, field);
                }
                GameCamera.instance.CheckLowestBall();
            }
            EventManager.GetEvent<Level>(EGameEvent.LevelLoaded).Invoke(Level);
            // enable visible colliders and disable invisible
            LevelUtils.CheckColliders(balls);
            // fill neibhours for all balls
            LevelUtils.FillNeibhours(balls);
            // init moves and time manager
            gameObject.GetComponent<MovesTimeManager>().Init(Level.moves, Level.levelMode);
            // enable holes if it is enabled in editor
            holes.SetActive(Level.holes);
            // enable bottom border if holes are disabled
            bottomBorder.SetActive(!Level.holes);
            // init score and target UI
            GameUIManager.instance.InitScoreAndTarget(Level.stars, Level, instance);
            // show preplay banner
            MenuManager.instance.ShowPopup<PrePlayBanner>(null, StartGame);

            EventManager.GetEvent<Ball>(EGameEvent.BallLaunched).Subscribe(SetBallLaunched);
            EventManager.GetEvent<(Ball,Ball)>(EGameEvent.BallStopped).Subscribe(PostLaunchProcess);
            EventManager.GetEvent<EStatus>(EGameEvent.Win).Subscribe(WinAnimation);
            EventManager.GetEvent(EGameEvent.CheckSeparatedBalls).Subscribe(AfterDestroyProcess);
        }

        /// Set ball that was launched to wait for the stop
        private void SetBallLaunched(Ball obj)
        {
            ballLaunched = obj;
        }

        /// Show tutorial popup
        private void TutorialShow()
        {
            var popup = MenuManager.instance.ShowPopup<TutorialBanner>();
            popup.SetTutorialSetup(Level.tutorial);
        }

        private void StartGame(EPopupResult ePopupResult)
        {
            //spend life at the start of the level to prevent cheating
            GameManager.instance.life.Consume(1);
            EventManager.SetGameStatus(EStatus.Play);
            
            if(Level.tutorial != null)
            {
                EventManager.SetGameStatus(EStatus.Tutorial);
                TutorialShow();
            }
            // Check for any separated balls which soar alone.
            separatingBallManager.Init(balls, Level);
            separatingBallManager.CheckSeparatedBalls();
        }

        private void OnDisable()
        {
            EventManager.GetEvent<(Ball,Ball)>(EGameEvent.BallStopped).Unsubscribe(PostLaunchProcess);
            EventManager.GetEvent<EStatus>(EGameEvent.Win).Unsubscribe(WinAnimation);
            EventManager.GetEvent<Ball>(EGameEvent.BallLaunched).Unsubscribe(SetBallLaunched);
            EventManager.GetEvent(EGameEvent.CheckSeparatedBalls).UnSubscribe(AfterDestroyProcess);
        }


        /// Checks targets and game fail or win
        IEnumerator CheckMovesAndTargets()
        {
            if(TargetManager.instance.IsTargetsDone() && EventManager.GameStatus != EStatus.Win)
            {
                EventManager.SetGameStatus(EStatus.Win);
                yield break;
            }
            
            yield return new WaitWhile(() => GroupAnimationManager.instance.AnyAnimation());
            if(destroyManager.GetBallsToDestroy().Count > 0 || ballLaunched ) 
                yield break;
            yield return new WaitWhile(() => levelGridManager.AnyBallsAreGoingToDestroyOrFalling());
            var offsprings = FindObjectsOfType<RandomDestructorOffspring>();
            if (offsprings.Length > 0)
                yield break;
            if (MovesTimeManager.instance.GetMoves() <= 0 && !TargetManager.instance.IsTargetsDone() && EventManager.GameStatus != EStatus.Win)
                EventManager.SetGameStatus(EStatus.Fail);
            else if (TargetManager.instance.IsTargetsDone())
            {
                EventManager.SetGameStatus(EStatus.Win);
            }
            yield return null;
        }
        
        public void CheckMovesAndTargetsAfterDestroy()
        {
            if(EventManager.GameStatus == EStatus.Play)
            {
                if (coroutineCheckMovesAndTargets != null)
                    StopCoroutine(coroutineCheckMovesAndTargets);
                coroutineCheckMovesAndTargets = CheckMovesAndTargets();
                StartCoroutine(coroutineCheckMovesAndTargets);
            }
        }
        private void WinAnimation(EStatus eStatus)
        {
            EventManager.GetEvent<(Ball,Ball)>(EGameEvent.BallStopped).Unsubscribe(PostLaunchProcess);
            EventManager.GetEvent<EStatus>(EGameEvent.Win).Unsubscribe(WinAnimation);
            StartCoroutine(WinAnimationProcess());
        }

        private IEnumerator WinAnimationProcess()
        {
            yield return new WaitForSeconds(1f);
            bool waitforPopup = true;
            MenuManager.instance.ShowPopup<PreWinBanner>(null, (result) => waitforPopup = false);

            for (int y = balls.Count - 1; y >= 0; y--)
            {
                for (int x = 0; x < balls[y].Count; x++)
                {
                    var ball = balls[y][x];
                    if (ball != null)
                    {
                        if (ball.gameObject.activeSelf)
                        {
                            ball.Fall();
                            yield return new WaitForSeconds(Random.Range(0.01f, 0.1f));
                        }
                    }
                }
            }

            Instantiate(Resources.Load("FX/FireworkLauncher"));
            
            yield return new WaitUntil(()=>!waitforPopup);

            float t = 0;
            var gameCamera = GameCamera.instance;
            while (MovesTimeManager.instance.GetMoves() > 0 || launchContainer.BallCharged != null)
            {
                t+=5;
                //launch ball
                var point = gameCamera.transform.position + new Vector3(Mathf.PingPong(t, 30) - 15, 10);
                launchContainer.LaunchBall(RaycastData.MockData(point));
                if(Level.levelMode == ELevelMode.Time)
                    MovesTimeManager.instance.SpendMove(null);
                yield return new WaitForSeconds(.1f);
            }
            
            var bottom = Camera.main.ScreenToWorldPoint(GameCamera.instance.CalculateScreenBounds().bottomLeft);
            // wait for all balls to disable
            yield return new WaitUntil(()=>balls.SelectMany(list => list).All(ball => ball == null || !ball.gameObject.activeSelf));
            yield return new WaitWhile(() => FindObjectsByType<Ball>(FindObjectsSortMode.None).Any(ball =>
                ball != null && ball.gameObject.activeSelf && ball.transform.position.y > bottom.y && ball.GetComponent<Rigidbody2D>().velocity.magnitude > 0));

            GameDataManager.instance.SaveLevel(CurrentLevel, ScoreManager.instance.GetScore());

            MenuManager.instance.ShowPopup<MenuWin>();
        }

        /// Process actions after a thrown ball stopped
        private void PostLaunchProcess((Ball, Ball) valueTuple)
        {
            ballLaunched = null;
            StartCoroutine(PostLaunchProcessCoroutine(valueTuple));
        }
        
        /// Process actions after a thrown ball stopped
        IEnumerator PostLaunchProcessCoroutine((Ball, Ball) ball)
        {
            yield return new WaitForEndOfFrame();
            LevelUtils.UpdateNeighbours(ball.Item1);

            // get neighbouring balls of the stopped ball
            var touchedBalls = LevelGridManager.GetTouchedBalls(ball);
            
            // Trigger the OnTouched event for the thrown ball and all touched balls.
            LevelGridManager.TriggerTouchedBalls(ball, touchedBalls);

            // Check for matches with the thrown ball.
            if (ball.Item1 is ColorBall colorBall)
            {
                matchCount = matchingManager.CheckMatch(colorBall);
            }
            
            // Handle any balls that were touched by the thrown ball and need to be destroyed.
            LevelGridManager.HandleTouchedBalls(ball, touchedBalls);

            // if there are balls to destroy then destroy them and wait for animations
            var countToDestroy = destroyManager.GetBallsToDestroy().Count;
            
            // if there are balls to destroy then add combo and add one bee
            if(matchCount >= GameManager.instance.GameSettings.matchSettingsCount || destroyManager.AnyExplosiveToDestroy())
            {
                comboCount++;
                ScoreManager.instance.SetCombo(comboCount);
                if(EventManager.GameStatus == EStatus.Play && Level.holes)
                    BouncingManager.instance.AddBouncing();
            }
            // if there are no balls to destroy then reset the combo and remove one bee
            else
            {
                comboCount = 0;
                ScoreManager.instance.SetCombo( comboCount);
                if(Level.holes)
                    BouncingManager.instance.RemoveBouncing();
            }
            if(destroyManager.AnyToDestroy())
            {
                // Destroy balls and wait for target animations
                yield return StartCoroutine(destroyManager.DestroyBalls(ball.Item1, this, separatingBallManager));
            }
            
            yield return AfterDestroyProcess(countToDestroy);
        }
        
        public void AfterDestroyProcess()
        {
            StartCoroutine(AfterDestroyProcess(1));
        }

        private IEnumerator AfterDestroyProcess(int countToDestroy)
        {
            if (countToDestroy > 0)
            {
                // Update the neighbours of the balls
                LevelUtils.UpdateNeighbours(balls);
                // Check for any separated balls which soar alone.
                yield return separatingBallManager.CheckSeparatedBalls();
            }

            // check lowest ball to adjust camera position
            GameCamera.instance.CheckLowestBall();

            // Check for any colliders that need to be updated.
            LevelUtils.CheckColliders(balls);
            
            // Update the neighbours of the balls
            LevelUtils.UpdateNeighbours(balls);
            
            // check win and lose conditions
            CheckMovesAndTargetsAfterDestroy();
        }
    }
}
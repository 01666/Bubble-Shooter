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
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers;
using BubbleShooterGameToolkit.Scripts.Gameplay.GUI;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.ExtraItems;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    /// control the moves and time of the game
    public class MovesTimeManager : SingletonBehaviour<MovesTimeManager>
    {
        private int moves;
        public ELevelMode levelLevelMode;

        public void Init(int initialMoves, ELevelMode levelLevelMode)
        {
            moves = initialMoves;
            GameUIManager.instance.UpdateMoves(moves);
            this.levelLevelMode = levelLevelMode;
            if (levelLevelMode == ELevelMode.Time)
            {
                BallContainerBase.OnBallLaunched -= SpendMove;
                EventManager.GetEvent<EStatus>(EGameEvent.Play).Subscribe((x) => StartTimer());
            }
        }

        private void StartTimer()
        {
            if (this != null)
                StartCoroutine(StartTimerCor());
        }

        private void OnEnable()
        {
            BallContainerBase.OnBallLaunched += SpendMove;
        }
        
        private void OnDisable()
        {
            BallContainerBase.OnBallLaunched -= SpendMove;
            if (levelLevelMode == ELevelMode.Time)
            {
                EventManager.GetEvent<EStatus>(EGameEvent.Play).Unsubscribe((x)=>StartTimer());
            }
        }

        private IEnumerator StartTimerCor()
        {
            while (EventManager.GameStatus == EStatus.Play)
            {
                yield return new WaitForSeconds(1);
                SpendMove(null);
            }
        }

        public int GetMoves() => moves;

        public void SpendMove(Ball ball)
        {
            if(ball is BombPowerup)
                return;
            moves--;
            if (moves <= 0)
            {
                moves = 0;
                if(levelLevelMode == ELevelMode.Time && !LevelManager.instance.LevelGridManager.AnyBallsAreGoingToDestroyOrFalling())
                    LevelManager.instance.CheckMovesAndTargetsAfterDestroy();
            }
            GameUIManager.instance.UpdateMoves(moves);
        }
        
        // debug purpose
        public void SetMoveToOne()
        {
            moves = 1;
            GameUIManager.instance.UpdateMoves(moves);
        }
        public void SetMoves(int i)
        {
            moves = i;
            GameUIManager.instance.UpdateMoves(moves);
        }

        public void AddMoves(int additionalMoves)
        {
            moves += additionalMoves;
            GameUIManager.instance.UpdateMoves(moves);
        }
    }
}
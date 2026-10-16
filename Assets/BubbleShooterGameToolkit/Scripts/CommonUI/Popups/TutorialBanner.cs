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
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.CommonUI.Tutorials;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers;
using BubbleShooterGameToolkit.Scripts.Gameplay.GUI;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.Gameplay.Targets;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using BubbleShooterGameToolkit.Scripts.Utils;
using DG.Tweening;
using TMPro;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
    public class TutorialBanner : Popup
    {
        [SerializeField]
        private TextMeshProUGUI label;

        [SerializeField]
        private RectTransform hand;

        [SerializeField]
        private Fader fader;
        
        private TutorialSetup tutorialSetup;
        private int targetIndex;
        private Action afterHideAnimationBase;
        private Targetable ballSelected;
        private bool highlightTarget;
        private List<Ball> ballsToHightlight = new List<Ball>();
        private Ball launchingBall;
        
        // save canvases layers for objects to restore them after tutorial
        private Dictionary<Canvas, int> canvases = new Dictionary<Canvas, int>();
        private GameObject character;
        private GameObject targetUI;
        private IEnumerable<SpriteRenderer> dots;

        private void OnEnable()
        {
            EventManager.GetEvent<Ball>(EGameEvent.BallLaunched).Subscribe(OnBallLaunched);
            afterHideAnimationBase = base.AfterHideAnimation;
        }

        private void OnBallLaunched(Ball obj)
        {
            if(hand == null || !hand.gameObject.activeSelf)
                return;
            EventManager.GetEvent<Ball>(EGameEvent.BallLaunched).Unsubscribe(OnBallLaunched);
            EventManager.SetGameStatus(EStatus.Play);

            // clear tween
            hand.gameObject.SetActive(false);
            if(highlightTarget)
            {
                fader.FadeOut();
                Destroy(fader.gameObject, 1f);
                DimObjects();
            }
            hand.transform.DOKill();
            Destroy(hand.gameObject);
            afterHideAnimationBase();
            Close();
        }

        public void SetTutorialSetup(TutorialSetup setup)
        {
            tutorialSetup = setup;
            label.text = setup.text;
            highlightTarget = setup.highlightTarget;
            targetIndex = setup.target.prefab.GetComponent<Targetable>().GetTargetIndex();
            if (setup.launchBall != null)
                StartCoroutine(ReplaceBall());
            if(highlightTarget)
            {
                fader.GetComponent<Canvas>().sortingLayerID = SortingLayer.NameToID("Tutorial");
                fader.transform.SetParent(transform.parent);
                fader.FadeIn();
            }
        }

        private IEnumerator ReplaceBall()
        {
            if (tutorialSetup.launchBall != null)
            {
                LevelManager.instance.ballContainerSpawn.nextBallPrefabName = tutorialSetup.launchBall.name;
            }

            yield return new WaitUntil(() => LevelManager.instance.launchContainer.BallCharged != null);
        }

        public override void AfterShowAnimation()
        {
            List<Targetable> list = new List<Targetable>();
            // get lowest row from level manager List<List<Ball>> balls
            for (int i = LevelLoader.instance.CurrentLevel.sizeY - 1; i >= 0; i--)
            {
                var row = LevelManager.instance.balls[i];
                if (row.Count == 0)
                    continue;
                for (int j = 0; j < row.Count; j++)
                {
                    var ball = row[j];
                    if(ball != null && ball.IsTarget(targetIndex))
                        list.Add(ball);
                }
                if(list.Count > 0)
                    break;
            }
            ballSelected = list[list.Count / 2];
            
            if(highlightTarget)
            {
                HightlightObjects();
            }
            base.AfterShowAnimation();

            hand.gameObject.SetActive(true);
            hand.transform.SetParent(transform.parent);
            hand.SetSiblingIndex(transform.GetSiblingIndex());
            hand.transform.DOScale(1.2f, 0.5f).SetLoops(-1, LoopType.Yoyo).SetEase(Ease.InOutSine);
            hand.position = ballSelected.transform.position;
        }

        private void HightlightObjects()
        {
            var colorBall = ballSelected as ColorBall;
            if(colorBall != null)
            {
                ballsToHightlight = LevelManager.instance.matchingManager.GetMatchList(colorBall, 1);
                foreach (var ball in ballsToHightlight)
                {
                    ball.SetSortingLayer(SortingLayer.NameToID("Tutorial"));
                }
            }
            else
            {
                ballsToHightlight = LevelManager.instance.balls.SelectMany(x => x).Where(x => x != null).ToList();
                foreach (var ball in ballsToHightlight)
                {
                    ball.SetSortingLayer(SortingLayer.NameToID("Tutorial"));
                }
            }

            character = FindObjectOfType<CharacterAnimationController>().gameObject;
            ChangeOrder(character, -1);

            targetUI = FindObjectOfType<GameUIManager>().GetComponentInChildren<TargetContainerUI>().gameObject;
            ChangeOrder(targetUI);
            StartCoroutine(HightlightBall());
            dots = FindObjectsOfType<AimDot>().Select(x => x.GetComponentInChildren<SpriteRenderer>());
            foreach (var dot in dots)
            {
                dot.sortingLayerID = SortingLayer.NameToID("Tutorial");
            }
        }

        IEnumerator HightlightBall()
        {
            yield return new WaitWhile(()=>FindObjectOfType<LaunchContainer>().BallCharged == null);
            launchingBall = FindObjectOfType<LaunchContainer>().BallCharged;
            launchingBall.SetSortingLayer(SortingLayer.NameToID("Tutorial"));
        }
        private void ChangeOrder(GameObject obj, int order = 0)
        {
            var canvas = obj.AddComponentIfNotExists<Canvas>();
            if(canvases.ContainsKey(canvas))
                return;
            canvases.Add(canvas, canvas.sortingLayerID);
            canvas.overrideSorting = true;
            canvas.sortingLayerID = SortingLayer.NameToID("Tutorial");
            canvas.sortingOrder = order;
            var list = obj.GetComponentsInChildren<Canvas>();
            foreach (var canvasChild in list)
            {
                ChangeOrder(canvasChild.gameObject);
            }
        }

        private void DimObjects()
        {
            foreach (var ball in ballsToHightlight)
            {
                ball.SetSortingLayer(SortingLayer.NameToID("Bubble"));
            }

            foreach (var dot in dots)
            {
                dot.sortingLayerID = SortingLayer.NameToID("Default");
            }
            foreach (var canvas in canvases)
            {
                var canvasKey = canvas.Key;
                canvasKey.sortingLayerID = canvas.Value;
            }
            
            launchingBall.SetSortingLayer(SortingLayer.NameToID("Bubble"));
            Destroy(character.GetComponent<Canvas>());
            Destroy(targetUI.GetComponent<Canvas>());
        }

        public override void AfterHideAnimation()
        {
        }
    }
}
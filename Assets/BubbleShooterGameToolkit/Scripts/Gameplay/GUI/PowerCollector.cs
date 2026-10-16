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

using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.Settings;
using DG.Tweening;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.GUI
{
    public class PowerCollector : BallContainerBase
    {
        [SerializeField] private Image energyBar;
        [HideInInspector]
        public float power;
        private float powerStep = 0.1f;
        private readonly float maxPower = 1f;
        [SerializeField] private Ball prefab;

        [SerializeField]
        private GameObject activatedObjects;

        private Tweener anim;
        private Vector3 initialPosition;

        protected override void Start()
        {
            powerStep = Resources.Load<PowerSettings>("Settings/PowerSettings").powerStep;
            base.Start();
            // Set the initial fill amount for the energy bar
            energyBar.fillAmount = power / maxPower;
            UpdateEnergyBar();
            initialPosition = transform.localPosition;
            IdleAnimation();
        }

        private void IdleAnimation()
        {
            transform.DOLocalMoveY(transform.localPosition.y + 10f, 1f).SetLoops(-1, LoopType.Yoyo).SetEase(Ease.InOutSine);
        }

        private void OnEnable()
        {
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.ItemDestroyed).Subscribe(OnBallDestroyed);
        }

        private void OnDisable()
        {
            EventManager.GetEvent<BallCollectEventArgs>(EGameEvent.ItemDestroyed).Unsubscribe(OnBallDestroyed);
        }

        /// check ball color and add power 
        private void OnBallDestroyed(BallCollectEventArgs obj)
        {
            if(EventManager.GameStatus != EStatus.Play)
                return;
            if(obj.targetObject is not ColorBall)
                return;
            // Increment the power by the specified power step
            power += powerStep;
            // Clamp the power value between 0 and maxPower
            power = Mathf.Clamp(power, 0, maxPower);
            // Update the energy bar fill
            UpdateEnergyBar();
        }

        public void UpdateEnergyBar()
        {
            // Set the energy bar's fill amount to the current power value
            energyBar.fillAmount = power / maxPower;
            // Set the button to be interactive only when the power reaches its maximum value, preventing accidental usage during power accumulation.
            if(power >= maxPower && BallCharged == null)
            {
                if(anim != null && anim.IsActive() && anim.IsPlaying())
                    return;

                transform.localScale = Vector3.one;
                transform.DOKill();
                transform.localPosition = initialPosition;
                anim = transform.DOPunchScale(Vector3.one * 0.1f, 0.5f, 1, 1).SetLoops(-1, LoopType.Restart);
                anim.SetEase(Ease.InOutSine);
                activatedObjects.SetActive(true);
            }
        }
        
        /// release power and set power to ball
        public void ReleasePower()
        {
            if(power < maxPower)
                return;
            // Stop the punch animation
            transform.DOKill();
            transform.localScale = Vector3.one;
            
            BallCharged = SpawnBall(prefab.name);
            BallCharged.SetSortingLayer(SortingLayer.NameToID("UI"));
            if(BallCharged)
            {
                // Deactivate the power button
                activatedObjects.SetActive(false);
                
                // Set the power to the ball
                LevelManager.instance.launchContainer.SaveBall();
                SwitchBall(this, LevelManager.instance.launchContainer, BallCharged,  BallSwitched );
                // Reset the power value
                power = 0;
                // Update the energy bar fill
                UpdateEnergyBar();
                BallCharged = null;
                transform.localScale = Vector3.one;
                IdleAnimation();
            }
        }

        private void OnDestroy()
        {
            transform.DOKill();
        }

        private void BallSwitched(Ball b)
        {
            LevelManager.instance.launchContainer.BallCharged = b;
            b.SetSortingLayer(SortingLayer.NameToID("Default"));
        }
    }
}
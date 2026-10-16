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
using UnityEngine;


namespace BubbleShooterGameToolkit.Scripts.Services
{
    public class IAPManager : MonoBehaviour
    {
        public static IAPManager instance;

        private IIAPService iapController;

        public void InitializePurchasing(IEnumerable<string> products)
        {
            #if UNITY_PURCHASING
            iapController = new IAPController();
            iapController.InitializePurchasing(products);
            #else
            iapController = new DummyIAPService();
            #endif
        }
        private void Awake()
        {
            if (instance == null)
            {
                instance = this;
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public static void SubscribeToPurchaseEvent(Action<string> purchaseHandler)
        {
            #if UNITY_PURCHASING
            IAPController.OnSuccessfulPurchase += purchaseHandler;
            #endif
        }
        
        public static void UnsubscribeFromPurchaseEvent(Action<string> purchaseHandler)
        {
            #if UNITY_PURCHASING
            IAPController.OnSuccessfulPurchase -= purchaseHandler;
            #endif
        }

        public void BuyProduct(string productId)
        {
            iapController.BuyProduct(productId);
        }
        
        public decimal GetProductLocalizedPrice(string productId)
        {
            return iapController.GetProductLocalizedPrice(productId);
        }

        public string GetProductLocalizedPriceString(string productId)
        {
            return iapController.GetProductLocalizedPriceString(productId);
        }
    }

    public class DummyIAPService : IIAPService
    {
        public void InitializePurchasing(IEnumerable<string> products)
        {
            
        }

        public void BuyProduct(string productId)
        {
            
        }

        public decimal GetProductLocalizedPrice(string productId)
        {
            return 0m;
        }

        public string GetProductLocalizedPriceString(string productId)
        {
            return string.Empty;
        }
    }
}
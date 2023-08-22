using System.Collections;
using System.Collections.Generic;
using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(Collider))]
[RequireComponent(typeof(CoinCounter))]
public class CoinCollider : MonoBehaviour
{
    CoinCounter coinCounter;
    // Start is called before the first frame update
    void Start()
    {
        coinCounter = GetComponent<CoinCounter>();
    }

    private void OnTriggerEnter(Collider other) {
        if(other.gameObject.tag == "Coin")
        {
            CoinValue coinValue = other.gameObject.GetComponent<CoinValue>();
            if(coinValue != null) 
            {
                Debug.Log("FOUND A COIN");

                // Update our coin collection
                coinCounter.TotalCoins += coinValue.Value;

                // Destroy the coin object
                Destroy(other.gameObject);
                
            }
        }
    }
}
